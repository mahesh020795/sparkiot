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


def test_product_ui_standard_v3_controls_dashboard_and_widget_rhythm():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    for expected in [
        "Spark IoT Product UI Standard v3",
        "--spark-font-page-title",
        "--spark-font-widget-title",
        "--spark-widget-min-h",
        "--spark-dashboard-metric-max",
        ".spark-ui .product-header-grid",
        ".spark-ui .spark-widget-card",
        ".spark-ui .spark-widget-card .widget-header",
        ".spark-ui .spark-widget-card .channel-badge",
        ".spark-ui .spark-widget-card .value-display strong",
        ".spark-ui .project-stat-row span",
        "grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr))",
        "overflow: clip",
        "text-overflow: clip",
        "white-space: normal",
        "@media (max-width: 1180px)",
    ]:
        assert expected in design_system


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
        '"primary"',
        '"selector"',
        '"metrics"',
        "--spark-title-xl: clamp(1.55rem, 1.8vw, 2.05rem)",
        "--spark-metric-min",
        "--spark-compact-metric-min",
        "--spark-metric-min: 7.25rem",
        "--spark-compact-metric-min: 4.75rem",
        "--spark-header-metric-max: 39rem",
        '"primary selector metrics"',
        "repeat(auto-fit, minmax(min(100%, var(--spark-metric-min)), 1fr))",
        "repeat(3, minmax(0, 1fr))",
        "grid-row: 1 / span 2",
        "grid-column: 2",
        "contain: inline-size",
        "overflow-wrap: anywhere",
        ".spark-ui .dashboard-header-grid.spark-page-header-grid",
        ".spark-ui .spark-page-header-primary h1",
        ".spark-ui .project-stat-row span > *",
        ".spark-ui .project-stat-row strong,",
        ".spark-ui .project-stat-row small",
        "text-overflow: ellipsis;",
        "white-space: normal;",
        "@container spark-page-header (max-width: 84rem)",
        "@container spark-page-header (max-width: 58rem)",
        "@container spark-project-card (max-width: 20rem)",
    ]:
        assert expected in design_system
