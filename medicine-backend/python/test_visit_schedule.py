"""Test lõi Python của xuất lịch hẹn:
    python -m unittest discover -s python -v
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
import zipfile
from datetime import date
from pathlib import Path

from lxml import etree

import visit_schedule as vs

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "visit_schedule.py"
TEMPLATE = HERE.parent / "templates" / "A5409_VS_01_VisitSchedule.xlsx"
SHEET = "xl/worksheets/sheet1.xml"


def row(table: str, row_id: int, tuan: str | None, thuc_te: str | None, hen_tiep: str | None) -> dict:
    return {"tableName": table, "rowId": row_id, "tuan": tuan, "ngayThucTe": thuc_te, "ngayHenTiep": hen_tiep}


def day(iso: str) -> date:
    return date.fromisoformat(iso)


def serial(iso: str) -> str:
    return str(vs.excel_serial(day(iso)))


class BuildCellsTest(unittest.TestCase):
    """Quy tắc điền ô (contracts/exports/visit-schedule.md)."""

    def test_only_ptid_when_no_schedule_row(self):
        self.assertEqual(vs.build_cells("1000001A", []), {"A2": "PTID:  1000001A"})

    def test_empty_ptid_label_for_subject_without_ptid(self):
        self.assertEqual(vs.build_cells(None, []), {"A2": "PTID:  "})

    def test_screening_and_enrollment(self):
        cells = vs.build_cells(
            "1000001A",
            [row("SVC-01", 5, "Sàng lọc", "2026-01-05", "2026-01-20"), row("SVC-02", 9, "Tuyển chọn", "2026-01-20", "2026-01-27")],
        )
        self.assertEqual(
            cells,
            {
                "A2": "PTID:  1000001A",
                "G6": day("2026-01-05"),
                "F7": day("2026-01-20"),
                "G7": day("2026-01-20"),
                "F8": day("2026-01-27"),
            },
        )

    def test_follow_up_weeks_map_to_template_rows(self):
        for tuan, line in [("Tuần 1", 8), ("Tuần 2", 9), ("Tuần 3", 10), ("Tuần 4", 11), ("Tuần 6", 12), ("Tuần 8", 13),
                           ("Tuần 10", 14), ("Tuần 12", 15), ("Tuần 16", 16), ("Tuần 20", 17), ("Tuần 26", 18)]:
            with self.subTest(tuan=tuan):
                cells = vs.build_cells("X", [row("SVC-04", 1, tuan, "2026-03-02", "2026-03-09")])
                self.assertEqual(cells[f"G{line}"], day("2026-03-02"))
                self.assertEqual(cells[f"F{line + 1}"], day("2026-03-09"))

    def test_no_next_appointment_after_week_52(self):
        cells = vs.build_cells("X", [row("SVC-04", 1, "Tuần 52", "2027-01-04", "2027-01-11")])
        self.assertEqual(cells, {"A2": "PTID:  X", "G19": day("2027-01-04")})

    def test_skips_unknown_or_malformed_weeks_instead_of_row_3(self):
        for tuan in ["Tuần 5", "2.1", None, "Tuần 2a", "Tuần ٢"]:
            with self.subTest(tuan=tuan):
                cells = vs.build_cells("X", [row("SVC-04", 1, tuan, "2026-03-02", "2026-03-09")])
                self.assertEqual(cells, {"A2": "PTID:  X"})

    def test_accepts_spaces_around_week_number_like_cint(self):
        cells = vs.build_cells("X", [row("SVC-04", 1, "Tuần  2 ", "2026-03-02", None)])
        self.assertEqual(cells["G9"], day("2026-03-02"))

    def test_decomposed_vietnamese_week_label(self):
        # "Tuần" gõ dạng tổ hợp (NFD) vẫn được bỏ đúng 5 ký tự đầu
        import unicodedata

        cells = vs.build_cells("X", [row("SVC-04", 1, unicodedata.normalize("NFD", "Tuần 2"), "2026-03-02", None)])
        self.assertEqual(cells["G9"], day("2026-03-02"))

    def test_missing_dates_leave_cells_untouched(self):
        cells = vs.build_cells(
            "X", [row("SVC-01", 1, "Sàng lọc", "2026-01-05", None), row("SVC-04", 2, "Tuần 1", None, "2026-01-12")]
        )
        self.assertEqual(cells, {"A2": "PTID:  X", "G6": day("2026-01-05"), "F9": day("2026-01-12")})

    def test_smallest_row_id_wins_on_duplicates(self):
        cells = vs.build_cells(
            "X",
            [
                row("SVC-02", 30, "Tuyển chọn", "2026-02-01", "2026-02-08"),
                row("SVC-02", 12, "Tuyển chọn", "2026-01-20", None),
                row("SVC-04", 41, "Tuần 1", "2026-01-28", "2026-02-04"),
                row("SVC-04", 40, "Tuần 1", "2026-01-27", "2026-02-03"),
            ],
        )
        self.assertEqual(cells["G7"], day("2026-01-20"))
        # Dòng RowID nhỏ nhất không có ngày hẹn tiếp nên F8 để trống
        self.assertNotIn("F8", cells)
        self.assertEqual(cells["G8"], day("2026-01-27"))
        self.assertEqual(cells["F9"], day("2026-02-03"))

    def test_ignores_other_schedule_tables(self):
        cells = vs.build_cells("X", [row("SVC-05", 1, "Tuần 1", "2026-01-05", "2026-01-12")])
        self.assertEqual(cells, {"A2": "PTID:  X"})


class FillTemplateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)

    def fill(self, ptid: str | None, rows: list[dict]) -> zipfile.ZipFile:
        output = os.path.join(self.tmp.name, "out.xlsx")
        vs.fill_template(str(TEMPLATE), output, ptid, rows)
        archive = zipfile.ZipFile(output)
        self.addCleanup(archive.close)
        return archive

    @staticmethod
    def cells(archive: zipfile.ZipFile) -> dict[str, etree._Element]:
        sheet = etree.fromstring(archive.read(SHEET))
        return {c.get("r"): c for c in sheet.iter(vs.tag("c"))}

    @staticmethod
    def value(cell: etree._Element) -> str | None:
        v = cell.find(vs.tag("v"))
        return v.text if v is not None else None

    @staticmethod
    def num_fmt(archive: zipfile.ZipFile, cell: etree._Element) -> str:
        styles = etree.fromstring(archive.read("xl/styles.xml"))
        return styles.find(vs.tag("cellXfs")).findall(vs.tag("xf"))[int(cell.get("s", "0"))].get("numFmtId")

    def test_keeps_every_other_part_of_the_template_byte_for_byte(self):
        archive = self.fill("1000001A", [row("SVC-02", 1, "Tuyển chọn", "2026-01-20", "2026-01-27")])
        changed = {SHEET, "xl/workbook.xml"}
        with zipfile.ZipFile(TEMPLATE) as template:
            self.assertEqual(archive.namelist(), template.namelist())
            for name in template.namelist():
                if name not in changed:
                    self.assertEqual(archive.read(name), template.read(name), name)
            # Ghi chú người thiết kế, customXml, cài đặt máy in vẫn còn
            self.assertIn("xl/threadedComments/threadedComment1.xml", archive.namelist())
            self.assertIn("xl/printerSettings/printerSettings1.bin", archive.namelist())

    def test_only_written_cells_and_formula_results_change_in_the_sheet(self):
        archive = self.fill("1000001A", [row("SVC-02", 1, "Tuyển chọn", "2026-01-20", "2026-01-27")])
        with zipfile.ZipFile(TEMPLATE) as template:
            before, after = self.cells(template), self.cells(archive)
            original_sheet = etree.fromstring(template.read(SHEET))
        new_sheet = etree.fromstring(archive.read(SHEET))

        self.assertEqual(set(after), set(before))
        for ref, cell in before.items():
            if ref in {"A2", "G7", "F8"}:
                continue
            with self.subTest(ref=ref):
                self.assertEqual(dict(after[ref].attrib), dict(cell.attrib))
                f_before, f_after = cell.find(vs.tag("f")), after[ref].find(vs.tag("f"))
                if f_before is None:
                    self.assertEqual(etree.tostring(after[ref]), etree.tostring(cell))
                else:
                    self.assertEqual((f_after.text, dict(f_after.attrib)), (f_before.text, dict(f_before.attrib)))

        # Ngoài sheetData (ô gộp, lề, thiết lập in, header/footer...) giữ nguyên
        for tag in ["sheetPr", "dimension", "sheetViews", "cols", "mergeCells", "pageMargins", "pageSetup",
                    "headerFooter", "colBreaks", "legacyDrawing"]:
            with self.subTest(tag=tag):
                self.assertEqual(etree.tostring(new_sheet.find(vs.tag(tag))), etree.tostring(original_sheet.find(vs.tag(tag))))

    def test_writes_ptid_and_dates_in_short_date_format(self):
        archive = self.fill(
            "1000001A",
            [row("SVC-02", 1, "Tuyển chọn", "2026-01-20", "2026-01-27"), row("SVC-04", 2, "Tuần 52", "2027-01-04", None)],
        )
        cells = self.cells(archive)

        a2 = cells["A2"]
        self.assertEqual(a2.get("t"), "inlineStr")
        self.assertEqual(a2.find(f"{vs.tag('is')}/{vs.tag('t')}").text, "PTID:  1000001A")
        self.assertEqual(self.value(cells["G7"]), serial("2026-01-20"))
        self.assertEqual(self.value(cells["F8"]), serial("2026-01-27"))
        self.assertEqual(self.value(cells["G19"]), serial("2027-01-04"))
        # Định dạng ngày ngắn của mẫu, kể cả ô dòng 17–19 vốn là General
        for ref in ["G7", "F8", "G19"]:
            self.assertEqual(self.num_fmt(archive, cells[ref]), "14", ref)
        # Ô không ghi giữ công thức; ô tô vàng vẫn trống
        self.assertEqual(cells["C8"].find(vs.tag("f")).text, "$C$7+K8")
        self.assertIsNone(self.value(cells["C3"]))
        self.assertIsNone(self.value(cells["G3"]))

    def test_general_cells_get_a_cloned_style_that_keeps_font_and_border(self):
        archive = self.fill("X", [row("SVC-04", 1, "Tuần 20", "2026-06-01", "2026-07-01")])
        styles = etree.fromstring(archive.read("xl/styles.xml")).find(vs.tag("cellXfs")).findall(vs.tag("xf"))
        g17 = styles[int(self.cells(archive)["G17"].get("s"))]
        original = styles[15]
        self.assertEqual(
            {k: v for k, v in g17.attrib.items() if k not in ("numFmtId", "applyNumberFormat")},
            {k: v for k, v in original.attrib.items() if k not in ("numFmtId", "applyNumberFormat")},
        )

    def test_stores_formula_results_like_the_access_example_3144213F(self):
        # File Access: sàng lọc 20/05/2026, hẹn tiếp 22/05/2026, chưa tuyển chọn
        archive = self.fill("3144213F", [row("SVC-01", 1, "Sàng lọc", "2026-05-20", "2026-05-22")])
        cells = self.cells(archive)
        value = lambda ref: self.value(cells[ref])

        self.assertEqual(value("C6"), serial("2026-05-20"))
        self.assertEqual(value("F6"), serial("2026-05-20"))
        self.assertEqual(value("B7"), serial("2026-05-20"))
        self.assertEqual(value("D7"), serial("2026-06-19"))
        # Chưa có ngày tuyển chọn: Excel hiện 00/01/1900, 04/01/1900, 07/01/1900, 10/01/1900 như Access
        self.assertEqual([value(r) for r in ["C7", "B8", "C8", "D8"]], ["0", "4", "7", "10"])

    def test_recomputes_follow_up_windows_including_shared_formulas(self):
        cells = self.cells(self.fill("X", [row("SVC-02", 1, "Tuyển chọn", "2026-01-20", None)]))
        value = lambda ref: self.value(cells[ref])

        self.assertEqual(value("C8"), serial("2026-01-27"))
        self.assertEqual(value("C10"), serial("2026-02-10"))  # shared formula si=0
        self.assertEqual(value("C16"), serial("2026-05-12"))  # shared formula si=2
        self.assertEqual(value("C19"), serial("2027-01-19"))
        self.assertEqual(value("B14"), serial("2026-03-24"))
        self.assertEqual(value("E13"), serial("2026-03-23"))  # shared formula si=1

    def test_overwriting_a_formula_cell_drops_calc_chain_consistently(self):
        archive = self.fill("X", [row("SVC-01", 1, "Sàng lọc", "2026-05-20", "2026-05-22")])  # F7 có công thức G7
        cells = self.cells(archive)

        self.assertIsNone(cells["F7"].find(vs.tag("f")))
        self.assertEqual(self.value(cells["F7"]), serial("2026-05-22"))
        self.assertNotIn("xl/calcChain.xml", archive.namelist())
        self.assertNotIn(b"calcChain", archive.read("xl/_rels/workbook.xml.rels"))
        self.assertNotIn(b"calcChain", archive.read("[Content_Types].xml"))

    def test_asks_excel_to_recalculate_on_open(self):
        workbook = etree.fromstring(self.fill("X", []).read("xl/workbook.xml"))
        self.assertEqual(workbook.find(vs.tag("calcPr")).get("fullCalcOnLoad"), "1")

    def test_shift_formula_keeps_absolute_references(self):
        self.assertEqual(vs.shift_formula("$C$7+K9", 0, 3), "$C$7+K12")
        self.assertEqual(vs.shift_formula("B14-1", 1, -1), "C13-1")


class CommandLineTest(unittest.TestCase):
    """Chạy đúng như server gọi: tiến trình riêng, dữ liệu qua stdin."""

    def run_script(self, *args: str, stdin: str = "") -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args], input=stdin.encode("utf-8"), capture_output=True, timeout=60
        )

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.output = os.path.join(self.tmp.name, "out.xlsx")

    def test_reads_json_from_stdin_and_writes_the_file(self):
        data = {"ptid": "1000001A", "rows": [row("SVC-01", 1, "Sàng lọc", "2026-01-05", "2026-01-20")]}
        result = self.run_script("--template", str(TEMPLATE), "--output", self.output, stdin=json.dumps(data, ensure_ascii=False))

        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))
        with zipfile.ZipFile(self.output) as archive:
            self.assertIn(b"PTID:  1000001A", archive.read(SHEET))

    def test_reads_json_from_a_file(self):
        input_path = os.path.join(self.tmp.name, "in.json")
        Path(input_path).write_text(json.dumps({"ptid": "Z", "rows": []}), encoding="utf-8")
        result = self.run_script("--template", str(TEMPLATE), "--output", self.output, "--input", input_path)

        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8"))

    def test_missing_template_exits_1_without_output(self):
        result = self.run_script("--template", "khong-ton-tai.xlsx", "--output", self.output, stdin='{"ptid": null, "rows": []}')

        self.assertEqual(result.returncode, 1)
        self.assertIn("Lỗi", result.stderr.decode("utf-8"))
        self.assertFalse(os.path.exists(self.output))
        self.assertEqual(os.listdir(self.tmp.name), [])

    def test_invalid_input_exits_1(self):
        for stdin in ["không phải json", "[]", '{"ptid": 5, "rows": []}', '{"ptid": "X", "rows": [{"tableName": "SVC-01"}]}',
                      '{"ptid": "X", "rows": [{"tableName": "SVC-01", "rowId": 1, "ngayThucTe": "20/05/2026"}]}']:
            with self.subTest(stdin=stdin):
                result = self.run_script("--template", str(TEMPLATE), "--output", self.output, stdin=stdin)
                self.assertEqual(result.returncode, 1)
                self.assertFalse(os.path.exists(self.output))


if __name__ == "__main__":
    unittest.main()
