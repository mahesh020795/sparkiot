from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_CSS = ROOT / "frontend" / "src" / "styles" / "app.css"
DESIGN_SYSTEM_CSS = ROOT / "frontend" / "src" / "styles" / "design-system.css"
DISABLED_LEGACY_MARKER = "Legacy final duplicate dashboard layer disabled"


def active_app_css_without_disabled_legacy_block() -> str:
    app_css = APP_CSS.read_text(encoding="utf-8")
    return app_css.split(DISABLED_LEGACY_MARKER, 1)[0]


def test_dashboard_shell_is_owned_by_design_system_v2():
    app_css = APP_CSS.read_text(encoding="utf-8")
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    assert "Spark IoT UI Standard v2" in design_system
    assert ".spark-ui .spark-page-header-grid.dashboard-header-grid" in design_system
    assert ".spark-ui.dashboard-shell .dashboard-main .topbar h1" in design_system
    assert "Gemini exact cockpit pass" not in app_css
    assert DISABLED_LEGACY_MARKER in app_css


def test_app_css_does_not_reintroduce_final_dashboard_header_override_layer():
    app_css = active_app_css_without_disabled_legacy_block()

    forbidden_late_layer_markers = [
        ".dashboard-shell .brand",
        ".dashboard-main .gemini-widget-canvas",
    ]
    for marker in forbidden_late_layer_markers:
        assert marker not in app_css


def test_dashboard_and_project_summary_cards_are_overflow_safe():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    for expected in [
        '"primary selector"',
        '"metrics metrics"',
        "--spark-metric-min",
        "--spark-compact-metric-min",
        "repeat(auto-fit, minmax(min(100%, var(--spark-metric-min)), 1fr))",
        "repeat(auto-fit, minmax(min(100%, var(--spark-compact-metric-min)), 1fr))",
        "contain: inline-size",
        "overflow-wrap: anywhere",
        ".spark-ui .project-stat-row span > *",
        ".spark-ui .project-stat-row strong,",
        ".spark-ui .project-stat-row small",
        "text-overflow: ellipsis;",
        "white-space: nowrap;",
    ]:
        assert expected in design_system
