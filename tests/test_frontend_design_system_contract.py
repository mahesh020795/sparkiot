import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_CSS = ROOT / "frontend" / "src" / "styles" / "app.css"
DESIGN_SYSTEM_CSS = ROOT / "frontend" / "src" / "styles" / "design-system.css"
DISABLED_LEGACY_MARKER = "Legacy final duplicate dashboard layer disabled"
LEGACY_BRAND_HEX_VALUES = {
    "#071126",
    "#0f172a",
    "#111827",
    "#1455ff",
    "#1f2937",
    "#2563eb",
}


def active_app_css_without_disabled_legacy_block() -> str:
    app_css = APP_CSS.read_text(encoding="utf-8")
    return app_css.split(DISABLED_LEGACY_MARKER, 1)[0]


def rule_bodies_for_selector(css: str, selector: str) -> list[str]:
    rules = re.findall(r"([^{}]+)\{([^{}]*)\}", css, flags=re.DOTALL)
    return [
        body
        for selector_group, body in rules
        if selector
        in {
            candidate.strip()
            for candidate in re.sub(
                r"/\*.*?\*/", "", selector_group, flags=re.DOTALL
            ).split(",")
        }
    ]


def test_dashboard_shell_is_owned_by_design_system_v2():
    app_css = APP_CSS.read_text(encoding="utf-8")
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    assert "Spark IoT UI Standard v2" in design_system
    assert ".spark-ui .spark-page-header-grid.dashboard-header-grid" in design_system
    assert ".spark-ui.dashboard-shell .dashboard-main .topbar h1" in design_system
    assert "Gemini exact cockpit pass" not in app_css
    assert DISABLED_LEGACY_MARKER in app_css


def test_hesh_product_ui_standard_v4_controls_dashboard_and_widget_rhythm():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    for expected in [
        "Hesh IoT Product UI Standard v4",
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


def test_hesh_v4_semantics_map_brand_actions_interactions_and_health():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    for expected in [
        "--hesh-orange: #f25522",
        "--hesh-ink: #121722",
        "--hesh-cobalt: #2457f5",
        "--hesh-online: #22a865",
        "--hesh-canvas: #f7f6f2",
        "--spark-bg: var(--hesh-canvas)",
        "--spark-primary: var(--hesh-cobalt)",
        "--spark-success: var(--hesh-online)",
        "--spark-control-height: 44px",
        "@media (prefers-reduced-motion: reduce)",
    ]:
        assert expected in design_system

    primary_rules = rule_bodies_for_selector(design_system, ".spark-ui .primary")
    assert primary_rules
    assert any("background: var(--hesh-orange)" in body for body in primary_rules)
    assert any("color: var(--hesh-ink)" in body for body in primary_rules)

    active_navigation_rules = rule_bodies_for_selector(
        design_system, ".spark-ui .sidebar nav button.active"
    )
    assert active_navigation_rules
    assert any("background: #edf2ff" in body for body in active_navigation_rules)
    assert any("color: var(--hesh-cobalt)" in body for body in active_navigation_rules)

    focus_rules = rule_bodies_for_selector(
        design_system, ".spark-ui button:focus-visible"
    )
    assert focus_rules
    assert any(
        "outline: 3px solid var(--hesh-cobalt)" in body for body in focus_rules
    )

    healthy_status_rules = rule_bodies_for_selector(
        design_system, ".spark-ui .status-dot.online"
    )
    assert healthy_status_rules
    assert any(
        "background: var(--spark-success)" in body for body in healthy_status_rules
    )


def test_hesh_v4_canonical_brand_and_primary_rules_exclude_legacy_brand_hex():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8").lower()
    canonical_bodies = [
        *rule_bodies_for_selector(design_system, ".spark-ui .brand .brand-icon"),
        *rule_bodies_for_selector(design_system, ".spark-ui .brand strong"),
        *rule_bodies_for_selector(design_system, ".spark-ui .primary"),
        *rule_bodies_for_selector(design_system, ".spark-ui .action-button.primary"),
        *rule_bodies_for_selector(design_system, ".spark-ui .template-open-button"),
    ]

    assert canonical_bodies
    for legacy_hex in LEGACY_BRAND_HEX_VALUES:
        assert all(legacy_hex not in body for body in canonical_bodies)


def test_hesh_v4_specific_controls_cannot_override_action_focus_or_target_size():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")
    app_css = active_app_css_without_disabled_legacy_block()

    for selector in [
        ".spark-ui .entity-card-actions button.entity-edit-button",
        ".spark-ui .entity-card-actions .template-open-button.entity-edit-button",
        ".spark-ui .account-quickstart-card > button",
    ]:
        action_rules = rule_bodies_for_selector(design_system, selector)
        assert action_rules
        assert any("background: var(--hesh-orange)" in body for body in action_rules)
        assert any("color: var(--hesh-ink)" in body for body in action_rules)

    for selector in [
        ".spark-ui .account-quickstart-grid input",
        ".spark-ui .account-quickstart-grid select",
        ".spark-ui .account-quickstart-card > button",
    ]:
        control_rules = rule_bodies_for_selector(design_system, selector)
        assert control_rules
        assert any(
            "min-height: var(--spark-control-height)" in body
            for body in control_rules
        )

    for selector in [
        ".spark-ui .setup-summary-actions .primary:hover",
        ".spark-ui .entity-card-actions button.entity-edit-button:hover",
        (
            ".spark-ui .entity-card-actions "
            ".template-open-button.entity-edit-button:hover"
        ),
        ".spark-ui .account-quickstart-card > button.primary:hover",
    ]:
        scoped_hover_rules = rule_bodies_for_selector(design_system, selector)
        assert scoped_hover_rules
        assert any(
            "background: var(--spark-action-strong)" in body
            for body in scoped_hover_rules
        )

    for selector in ["input:focus", "select:focus", "textarea:focus"]:
        focus_rules = rule_bodies_for_selector(app_css, selector)
        assert focus_rules
        assert all("#2563eb" not in body.lower() for body in focus_rules)
        assert any("border-color: var(--hesh-cobalt)" in body for body in focus_rules)

    for selector in [
        "button:focus-visible",
        "a:focus-visible",
        "input:focus-visible",
        "select:focus-visible",
        "textarea:focus-visible",
    ]:
        focus_visible_rules = rule_bodies_for_selector(app_css, selector)
        assert focus_visible_rules
        assert all(
            "rgba(37, 99, 235" not in body for body in focus_visible_rules
        )
        assert any(
            "var(--hesh-cobalt)" in body for body in focus_visible_rules
        )


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
