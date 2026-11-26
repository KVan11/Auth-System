"""Node gọi script này, dữ liệu JSON qua stdin
Tự tính sẵn kết quả công thức vì Excel ở Protected View không tính lại
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import sys
import unicodedata
import zipfile
from datetime import date

from lxml import etree

# Quy tắc điền ô

# Tuần tái khám → dòng trong mẫu
WEEK_ROWS = {1: 8, 2: 9, 3: 10, 4: 11, 6: 12, 8: 13, 10: 14, 12: 15, 16: 16, 20: 17, 26: 18, 52: 19}
LAST_WEEK = 52


def parse_week(tuan: str | None) -> int | None:
    """'Tuần 12' → 12; giá trị lạ → None."""
    if tuan is None:
        return None
    rest = unicodedata.normalize("NFC", tuan)[5:].strip()
    if re.fullmatch(r"[0-9]+", rest):
        return int(rest)
    return None


def first_row(rows: list[dict]) -> dict | None:
    """Bị trùng thì lấy RowID nhỏ nhất."""
    if not rows:
        return None
    return min(rows, key=lambda row: row["rowId"])


def build_cells(ptid: str | None, rows: list[dict]) -> dict[str, str | date]:
    """Trả về {địa chỉ ô: giá trị}."""
    cells: dict[str, str | date] = {}
    cells["A2"] = "PTID:  " + (ptid if ptid is not None else "")

    def fill(row: dict | None, line: int, with_next_date: bool) -> None:
        """Ngày thực tế → cột G dòng này, ngày hẹn tiếp → cột F dòng sau."""
        if row is None:
            return
        if row["ngayThucTe"] is not None:
            cells[f"G{line}"] = date.fromisoformat(row["ngayThucTe"])
        if with_next_date and row["ngayHenTiep"] is not None:
            cells[f"F{line + 1}"] = date.fromisoformat(row["ngayHenTiep"])

    # Sàng lọc (dòng 6) và tuyển chọn (dòng 7)
    fill(first_row([row for row in rows if row["tableName"] == "SVC-01"]), 6, True)
    fill(first_row([row for row in rows if row["tableName"] == "SVC-02"]), 7, True)

    # Tái khám: gom theo tuần, tuần không có trong mẫu thì bỏ qua
    rows_by_week: dict[int, list[dict]] = {}
    for row in rows:
        if row["tableName"] != "SVC-04":
            continue
        week = parse_week(row["tuan"])
        if week not in WEEK_ROWS:
            continue
        rows_by_week.setdefault(week, []).append(row)

    for week in sorted(rows_by_week):
        # Tuần 52 là buổi cuối, không có hẹn tiếp
        fill(first_row(rows_by_week[week]), WEEK_ROWS[week], week != LAST_WEEK)

    return cells


# Sửa XML trong file .xlsx

SHEET_PATH = "xl/worksheets/sheet1.xml"
STYLES_PATH = "xl/styles.xml"
WORKBOOK_PATH = "xl/workbook.xml"
WORKBOOK_RELS_PATH = "xl/_rels/workbook.xml.rels"
CONTENT_TYPES_PATH = "[Content_Types].xml"
CALC_CHAIN_PATH = "xl/calcChain.xml"

NS = {
    "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"

# Định dạng ngày ngắn có sẵn của Excel
DATE_FORMAT_ID = "14"


def tag(name: str) -> str:
    """Tên đầy đủ của thẻ XML, dùng khi tạo phần tử mới."""
    return "{" + NS["x"] + "}" + name


def parse_xml(data: bytes) -> etree._Element:
    # Không tải tài nguyên bên ngoài (an toàn)
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    return etree.fromstring(data, parser)


def to_xml(root: etree._Element) -> bytes:
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


def excel_serial(value: date) -> int:
    """Excel lưu ngày là số ngày tính từ 30/12/1899."""
    return (value - date(1899, 12, 30)).days


def find_cell(sheet: etree._Element, address: str) -> etree._Element:
    cell = sheet.find(f".//x:c[@r='{address}']", NS)
    if cell is None:
        raise ValueError(f"Mẫu không có ô {address}")
    return cell


def clear_cell(cell: etree._Element) -> bool:
    """Xoá giá trị cũ, giữ kiểu. Trả về True nếu ô từng có công thức."""
    had_formula = cell.find("x:f", NS) is not None
    for child in list(cell):
        cell.remove(child)
    cell.attrib.pop("t", None)
    return had_formula


class DateStyles:
    """Ô chưa có định dạng ngày (F17:H19) thì tạo kiểu mới = kiểu cũ + định dạng ngày."""

    def __init__(self, styles_root: etree._Element):
        self.root = styles_root
        self.cell_styles = styles_root.find("x:cellXfs", NS)
        self.created: dict[int, int] = {}  # kiểu cũ → kiểu mới

    def changed(self) -> bool:
        return len(self.created) > 0

    def for_style(self, old_index: int) -> int:
        styles = self.cell_styles.findall("x:xf", NS)
        if styles[old_index].get("numFmtId") == DATE_FORMAT_ID:
            return old_index

        if old_index not in self.created:
            new_style = copy.deepcopy(styles[old_index])
            new_style.set("numFmtId", DATE_FORMAT_ID)
            new_style.set("applyNumberFormat", "1")
            self.cell_styles.append(new_style)
            self.cell_styles.set("count", str(len(styles) + 1))
            self.created[old_index] = len(styles)
        return self.created[old_index]


def write_text(cell: etree._Element, text: str) -> None:
    # inlineStr: ghi thẳng trong ô, không phải sửa sharedStrings
    cell.set("t", "inlineStr")
    inline = etree.SubElement(cell, tag("is"))
    text_element = etree.SubElement(inline, tag("t"))
    text_element.text = text
    # Giữ dấu cách cuối, vd. "PTID:  "
    text_element.set(XML_SPACE, "preserve")


def write_date(cell: etree._Element, value: date, date_styles: DateStyles) -> None:
    etree.SubElement(cell, tag("v")).text = str(excel_serial(value))
    old_style = int(cell.get("s", "0"))
    cell.set("s", str(date_styles.for_style(old_style)))


def write_cells(sheet: etree._Element, date_styles: DateStyles, cells: dict[str, str | date]) -> bool:
    """Trả về True nếu có ô công thức bị ghi đè (vd. F7)."""
    overwrote_formula = False
    for address, value in cells.items():
        cell = find_cell(sheet, address)
        if clear_cell(cell):
            overwrote_formula = True
        if isinstance(value, date):
            write_date(cell, value, date_styles)
        else:
            write_text(cell, value)
    return overwrote_formula


# Tự tính kết quả công thức

CELL_REF = re.compile(r"(\$?)([A-Z]+)(\$?)([0-9]+)")
SIMPLE_FORMULA = re.compile(r"^(\$?[A-Z]+\$?[0-9]+)(?:([+-])(\$?[A-Z]+\$?[0-9]+|[0-9]+))?$")


def column_number(letters: str) -> int:
    """'A' → 1, 'K' → 11, 'AA' → 27."""
    number = 0
    for letter in letters:
        number = number * 26 + (ord(letter) - ord("A") + 1)
    return number


def column_letters(number: int) -> str:
    """1 → 'A', 27 → 'AA'."""
    letters = ""
    while number > 0:
        number, rest = divmod(number - 1, 26)
        letters = chr(ord("A") + rest) + letters
    return letters


def split_address(address: str) -> tuple[int, int]:
    """'C9' → (cột 3, dòng 9)."""
    match = CELL_REF.fullmatch(address)
    return column_number(match.group(2)), int(match.group(4))


def shift_formula(formula: str, column_offset: int, row_offset: int) -> str:
    """Giống kéo công thức trong Excel: "$C$7+K9" xuống 1 dòng → "$C$7+K10"."""

    def shift_one(match: re.Match) -> str:
        column_fixed, column, row_fixed, row = match.groups()
        if not column_fixed:
            column = column_letters(column_number(column) + column_offset)
        if not row_fixed:
            row = str(int(row) + row_offset)
        return column_fixed + column + row_fixed + row

    return CELL_REF.sub(shift_one, formula)


class FormulaCalculator:
    """Tính giá trị các ô, kể cả công thức tham chiếu công thức khác."""

    def __init__(self, sheet: etree._Element):
        self.cells = {cell.get("r"): cell for cell in sheet.iter(tag("c"))}
        self.results: dict[str, float] = {}

        # Shared formula: Excel chỉ lưu công thức ở ô đầu nhóm, các ô khác chỉ ghi số nhóm (si)
        self.shared_formulas: dict[str, tuple[str, str]] = {}
        for address, cell in self.cells.items():
            formula = cell.find("x:f", NS)
            if formula is not None and formula.get("t") == "shared" and formula.text:
                self.shared_formulas[formula.get("si")] = (formula.text, address)

    def formula_text(self, address: str, formula: etree._Element) -> str:
        if formula.get("t") == "shared" and not formula.text:
            text, first_address = self.shared_formulas[formula.get("si")]
            first_column, first_row = split_address(first_address)
            column, row = split_address(address)
            return shift_formula(text, column - first_column, row - first_row)
        return formula.text

    def value(self, address: str) -> float:
        address = address.replace("$", "")
        if address not in self.results:
            self.results[address] = self.compute(address)
        return self.results[address]

    def compute(self, address: str) -> float:
        cell = self.cells.get(address)
        if cell is None:
            return 0.0  # ô trống tính là 0

        formula = cell.find("x:f", NS)
        if formula is not None:
            return self.evaluate(address, self.formula_text(address, formula))

        if cell.get("t") not in (None, "n"):
            raise ValueError(f"Ô {address} không phải số hay ngày")
        value = cell.find("x:v", NS)
        if value is None:
            return 0.0
        return float(value.text)

    def evaluate(self, address: str, formula: str) -> float:
        match = SIMPLE_FORMULA.match(formula)
        if match is None:
            raise ValueError(f"Công thức chưa hỗ trợ ở ô {address}: {formula}")

        left, operator, right = match.groups()
        result = self.value(left)
        if operator is None:
            return result

        if right.isdigit():
            right_value = float(right)
        else:
            right_value = self.value(right)

        if operator == "+":
            return result + right_value
        return result - right_value


def store_formula_results(sheet: etree._Element) -> None:
    calculator = FormulaCalculator(sheet)
    for address, cell in calculator.cells.items():
        if cell.find("x:f", NS) is None:
            continue
        result = calculator.value(address)
        value = cell.find("x:v", NS)
        if value is None:
            value = etree.SubElement(cell, tag("v"))
        # Ghi "46162" thay vì "46162.0"
        value.text = str(int(result)) if result.is_integer() else str(result)


# Điền mẫu và ghi file


def remove_calc_chain(files: dict[str, bytes]) -> None:
    """Ô công thức F7 bị ghi đè thì calcChain.xml sai, Excel báo lỗi. Xoá đi để Excel tự tạo lại."""
    if CALC_CHAIN_PATH not in files:
        return
    del files[CALC_CHAIN_PATH]

    rels = parse_xml(files[WORKBOOK_RELS_PATH])
    for relationship in rels.findall("rel:Relationship", NS):
        if relationship.get("Target") == "calcChain.xml":
            rels.remove(relationship)
    files[WORKBOOK_RELS_PATH] = to_xml(rels)

    content_types = parse_xml(files[CONTENT_TYPES_PATH])
    for override in content_types.findall("ct:Override", NS):
        if override.get("PartName") == "/" + CALC_CHAIN_PATH:
            content_types.remove(override)
    files[CONTENT_TYPES_PATH] = to_xml(content_types)


def fill_template(template_path: str, output_path: str, ptid: str | None, rows: list[dict]) -> None:
    with zipfile.ZipFile(template_path) as template:
        entries = template.infolist()
        files = {entry.filename: template.read(entry.filename) for entry in entries}

    sheet = parse_xml(files[SHEET_PATH])
    date_styles = DateStyles(parse_xml(files[STYLES_PATH]))
    overwrote_formula = write_cells(sheet, date_styles, build_cells(ptid, rows))

    store_formula_results(sheet)
    files[SHEET_PATH] = to_xml(sheet)
    if date_styles.changed():
        files[STYLES_PATH] = to_xml(date_styles.root)

    # Excel tính lại toàn bộ khi người dùng bật chỉnh sửa
    workbook = parse_xml(files[WORKBOOK_PATH])
    workbook.find("x:calcPr", NS).set("fullCalcOnLoad", "1")
    files[WORKBOOK_PATH] = to_xml(workbook)

    if overwrote_formula:
        remove_calc_chain(files)

    try:
        with zipfile.ZipFile(output_path, "w") as output:
            for entry in entries:
                if entry.filename in files:
                    output.writestr(entry, files[entry.filename])
    except Exception:
        # Không để lại file dở dang
        if os.path.exists(output_path):
            os.remove(output_path)
        raise


# Chạy từ dòng lệnh


def check_input(data: object) -> tuple[str | None, list[dict]]:
    if not isinstance(data, dict):
        raise ValueError("Dữ liệu vào phải là object JSON")

    ptid = data.get("ptid")
    rows = data.get("rows")
    if ptid is not None and not isinstance(ptid, str):
        raise ValueError("ptid phải là chuỗi hoặc null")
    if not isinstance(rows, list):
        raise ValueError("rows phải là mảng")

    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Mỗi dòng phải là object")
        if not isinstance(row.get("tableName"), str) or not isinstance(row.get("rowId"), int):
            raise ValueError("Mỗi dòng cần tableName (chuỗi) và rowId (số)")
        for key in ("tuan", "ngayThucTe", "ngayHenTiep"):
            if row.get(key) is not None and not isinstance(row[key], str):
                raise ValueError(f"{key} phải là chuỗi hoặc null")
    return ptid, rows


def main(argv: list[str] | None = None) -> int:
    # In được tiếng Việt trên Windows
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="Điền file mẫu lịch hẹn VS-01.")
    parser.add_argument("--template", required=True, help="file mẫu .xlsx")
    parser.add_argument("--output", required=True, help="file .xlsx tạo ra")
    parser.add_argument("--input", help="file JSON dữ liệu; bỏ trống thì đọc từ stdin")
    args = parser.parse_args(argv)

    try:
        if args.input:
            with open(args.input, encoding="utf-8") as file:
                raw_json = file.read()
        else:
            raw_json = sys.stdin.buffer.read().decode("utf-8")

        ptid, rows = check_input(json.loads(raw_json))
        fill_template(args.template, args.output, ptid, rows)
    except Exception as error:
        print(f"Lỗi: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
