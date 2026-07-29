import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_CSS = ROOT / "frontend" / "src" / "styles" / "app.css"
DESIGN_SYSTEM_CSS = ROOT / "frontend" / "src" / "styles" / "design-system.css"
TEMPLATE_STUDIO_PAGE = (
    ROOT / "frontend" / "src" / "pages" / "TemplateStudioPage.tsx"
)
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


def declarations_for_property(body: str, property_name: str) -> list[str]:
    return [
        value.strip()
        for value in re.findall(
            rf"(?:^|;)\s*{re.escape(property_name)}\s*:\s*([^;]+)",
            body,
            flags=re.MULTILINE,
        )
    ]


def final_property_value(css: str, selector: str, property_name: str) -> str:
    values = [
        value
        for body in rule_bodies_for_selector(css, selector)
        for value in declarations_for_property(body, property_name)
    ]
    assert values, f"missing {property_name!r} ownership for {selector!r}"
    return values[-1]


def css_hex_token(css: str, token_name: str) -> str:
    matches = re.findall(
        rf"{re.escape(token_name)}\s*:\s*(#[0-9a-fA-F]{{6}})\s*;",
        css,
    )
    assert matches, f"missing six-digit color token {token_name!r}"
    return matches[-1]


def relative_luminance(hex_color: str) -> float:
    channels = [
        int(hex_color[index : index + 2], 16) / 255
        for index in (1, 3, 5)
    ]
    linear = [
        channel / 12.92
        if channel <= 0.04045
        else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(first: str, second: str) -> float:
    lighter, darker = sorted(
        [relative_luminance(first), relative_luminance(second)], reverse=True
    )
    return (lighter + 0.05) / (darker + 0.05)


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

    assert (
        final_property_value(design_system, ".spark-ui .primary", "background")
        == "var(--hesh-orange)"
    )
    assert (
        final_property_value(design_system, ".spark-ui .primary", "color")
        == "var(--hesh-ink)"
    )
    assert (
        final_property_value(
            design_system, ".spark-ui .sidebar nav button.active", "background"
        )
        == "#edf2ff"
    )
    assert (
        final_property_value(
            design_system, ".spark-ui .sidebar nav button.active", "color"
        )
        == "var(--hesh-cobalt)"
    )
    assert (
        final_property_value(
            design_system, ".spark-ui button:focus-visible", "outline"
        )
        == "3px solid var(--hesh-cobalt)"
    )
    assert (
        final_property_value(
            design_system, ".spark-ui .status-dot.online", "background"
        )
        == "var(--spark-success)"
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
        assert (
            final_property_value(design_system, selector, "background")
            == "var(--hesh-orange)"
        )
        assert (
            final_property_value(design_system, selector, "color")
            == "var(--hesh-ink)"
        )

    for selector in [
        ".spark-ui .account-quickstart-grid input",
        ".spark-ui .account-quickstart-grid select",
        ".spark-ui .account-quickstart-card > button",
    ]:
        assert (
            final_property_value(design_system, selector, "min-height")
            == "var(--spark-control-height)"
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
        assert (
            final_property_value(design_system, selector, "background")
            == "var(--spark-action-strong)"
        )
        assert (
            final_property_value(design_system, selector, "color")
            == "var(--hesh-ink)"
        )

    for selector in ["input:focus", "select:focus", "textarea:focus"]:
        focus_rules = rule_bodies_for_selector(app_css, selector)
        assert focus_rules
        assert all("#2563eb" not in body.lower() for body in focus_rules)
        assert (
            final_property_value(app_css, selector, "border-color")
            == "var(--hesh-cobalt) !important"
        )

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
        assert (
            final_property_value(app_css, selector, "outline")
            == "3px solid var(--hesh-cobalt)"
        )


def test_hesh_v4_final_select_focus_ownership():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    select_focus = ".spark-ui select:not([multiple]):focus"
    assert (
        final_property_value(design_system, select_focus, "border-color")
        == "var(--hesh-cobalt) !important"
    )
    assert (
        final_property_value(design_system, select_focus, "outline")
        == "3px solid var(--hesh-cobalt)"
    )
    assert final_property_value(design_system, select_focus, "outline-offset") == "2px"


def test_hesh_v4_final_compact_control_target_ownership():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    for selector in [
        ".spark-ui .quick-test-command-grid button",
        ".spark-ui .connection-line button",
        ".spark-ui .launch-wizard-step button",
    ]:
        assert (
            final_property_value(design_system, selector, "min-height")
            == "var(--spark-control-height)"
        )

    assert (
        final_property_value(
            design_system, ".spark-ui .connection-line button", "width"
        )
        == "var(--spark-control-height)"
    )
    assert (
        final_property_value(
            design_system, ".spark-ui .connection-line button", "height"
        )
        == "var(--spark-control-height)"
    )


def test_hesh_v4_final_primary_hover_ownership_has_accessible_contrast():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    hover_selectors = [
        ".spark-ui .primary:hover",
        ".spark-ui .action-button.primary:hover",
        ".spark-ui .template-open-button:hover",
        ".spark-ui .setup-summary-actions .primary:hover",
        ".spark-ui .entity-card-actions button.entity-edit-button:hover",
        (
            ".spark-ui .entity-card-actions "
            ".template-open-button.entity-edit-button:hover"
        ),
        ".spark-ui .account-quickstart-card > button.primary:hover",
    ]
    for selector in hover_selectors:
        assert (
            final_property_value(design_system, selector, "background")
            == "var(--spark-action-strong)"
        )
        assert (
            final_property_value(design_system, selector, "color")
            == "var(--hesh-ink)"
        )

    assert contrast_ratio(
        css_hex_token(design_system, "--spark-action-strong"),
        css_hex_token(design_system, "--hesh-ink"),
    ) >= 4.5


def test_hesh_v4_final_selection_ownership():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")
    app_css = active_app_css_without_disabled_legacy_block()

    assert (
        final_property_value(
            design_system, ".spark-ui .builder-cell.selected", "outline"
        )
        == "3px solid color-mix(in srgb, var(--hesh-cobalt) 25%, transparent)"
    )
    assert (
        final_property_value(app_css, ".builder-cell.selected > .widget", "outline")
        == "2px solid var(--hesh-cobalt)"
    )


def test_hesh_v4_final_resize_handle_ownership():
    app_css = active_app_css_without_disabled_legacy_block()

    handle_after = ".react-grid-item > .react-resizable-handle::after"
    assert (
        final_property_value(app_css, handle_after, "border-right")
        == "3px solid var(--hesh-cobalt) !important"
    )
    assert (
        final_property_value(app_css, handle_after, "border-bottom")
        == "3px solid var(--hesh-cobalt) !important"
    )
    for selector in [
        ".react-grid-item > .react-resizable-handle-s::after",
        ".react-grid-item > .react-resizable-handle-n::after",
    ]:
        assert (
            final_property_value(app_css, selector, "border-bottom")
            == "3px solid var(--hesh-cobalt) !important"
        )
    assert (
        final_property_value(
            app_css,
            ".react-grid-item > .react-resizable-handle-e::after",
            "border-right",
        )
        == "3px solid var(--hesh-cobalt) !important"
    )


def test_hesh_v4_final_dashboard_grid_and_overflow_ownership():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")

    dashboard_grid = (
        ".spark-ui.dashboard-shell .product-header-grid.dashboard-header-grid"
    )
    assert (
        " ".join(
            final_property_value(design_system, dashboard_grid, "grid-template-areas")
            .replace("\n", " ")
            .split()
        )
        == '"primary" "selector" "metrics"'
    )
    for selector in [
        ".spark-ui.dashboard-shell .app-page-header",
        ".spark-ui.dashboard-shell .spark-page-header-grid.dashboard-header-grid",
        dashboard_grid,
        ".spark-ui.dashboard-shell .spark-page-header-selector",
        ".spark-ui.dashboard-shell .project-switcher",
    ]:
        assert final_property_value(design_system, selector, "overflow") == "visible"


def test_template_studio_canvas_label_does_not_claim_online_health_semantics():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")
    page = TEMPLATE_STUDIO_PAGE.read_text(encoding="utf-8")

    assert 'className="pill mode-pill">Actual dashboard canvas' in page
    assert 'className="pill online-pill">Actual dashboard canvas' not in page
    assert (
        final_property_value(design_system, ".spark-ui .mode-pill", "background")
        == "var(--spark-primary-soft)"
    )
    assert (
        final_property_value(design_system, ".spark-ui .mode-pill", "color")
        == "var(--spark-primary-strong)"
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
