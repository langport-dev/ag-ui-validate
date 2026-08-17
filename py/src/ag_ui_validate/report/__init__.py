"""ag-ui-validate.report: pure reporters over a core Report. No I/O - callers
decide where the strings go. Mirrors src/report/index.ts.
"""

from .json import report_to_dict, to_json_report
from .junit import to_junit
from .pretty import format_diagnostic_line, format_grouped_diagnostics, format_report_summary
from .sarif import to_sarif

__all__ = [
    "format_diagnostic_line",
    "format_grouped_diagnostics",
    "format_report_summary",
    "report_to_dict",
    "to_json_report",
    "to_sarif",
    "to_junit",
]
