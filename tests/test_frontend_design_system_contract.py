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
    return app_css.split(f"/* {DISABLED_LEGACY_MARKER}", 1)[0]


def active_frontend_author_css() -> str:
    """Return active author CSS in the import order declared by main.tsx."""
    return "\n".join(
        [
            active_app_css_without_disabled_legacy_block(),
            DESIGN_SYSTEM_CSS.read_text(encoding="utf-8"),
        ]
    )


def test_active_author_css_excludes_disabled_layer_with_balanced_comments():
    app_css = active_app_css_without_disabled_legacy_block()

    assert DISABLED_LEGACY_MARKER not in app_css
    assert app_css.count("/*") == app_css.count("*/")


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


def split_modeled_selector_list(selector_list: str) -> list[str]:
    selectors: list[str] = []
    current: list[str] = []
    depth = 0
    quote = ""
    for character in selector_list:
        if quote:
            current.append(character)
            if character == quote:
                quote = ""
            continue
        if character in {'"', "'"}:
            quote = character
            current.append(character)
        elif character in "([":
            depth += 1
            current.append(character)
        elif character in ")]":
            depth -= 1
            current.append(character)
        elif character == "," and depth == 0:
            selectors.append("".join(current).strip())
            current = []
        else:
            current.append(character)
    selectors.append("".join(current).strip())
    return [selector for selector in selectors if selector]


def modeled_selector_chain(selector: str) -> tuple[list[str], list[str]]:
    compounds: list[str] = []
    combinators: list[str] = []
    current: list[str] = []
    pending_combinator = ""
    depth = 0
    quote = ""

    def flush_compound() -> None:
        nonlocal current, pending_combinator
        compound = "".join(current).strip()
        if not compound:
            return
        if compounds:
            combinators.append(pending_combinator or " ")
        compounds.append(compound)
        current = []
        pending_combinator = ""

    for character in selector.strip():
        if quote:
            current.append(character)
            if character == quote:
                quote = ""
            continue
        if character in {'"', "'"}:
            quote = character
            current.append(character)
        elif character in "([":
            depth += 1
            current.append(character)
        elif character in ")]":
            depth -= 1
            current.append(character)
        elif depth == 0 and character in "+~":
            raise ValueError(
                "modeled cascade does not support sibling combinators"
            )
        elif depth == 0 and character == ">":
            flush_compound()
            pending_combinator = ">"
        elif depth == 0 and character.isspace():
            flush_compound()
            if compounds and not pending_combinator:
                pending_combinator = " "
        else:
            current.append(character)
    flush_compound()
    assert compounds, f"empty modeled selector {selector!r}"
    return compounds, combinators


def modeled_compound_constraints(compound: str) -> dict[str, object]:
    working = compound
    functions = re.findall(r":{1,2}[\w-]+\([^()]*\)", working)
    working = re.sub(r":{1,2}[\w-]+\([^()]*\)", "", working)
    pseudo_elements = re.findall(r"::[\w-]+", working)
    working = re.sub(r"::[\w-]+", "", working)
    attributes = re.findall(r"\[[^\]]+\]", working)
    working = re.sub(r"\[[^\]]+\]", "", working)
    ids = re.findall(r"#[\w-]+", working)
    working = re.sub(r"#[\w-]+", "", working)
    classes = re.findall(r"\.[\w-]+", working)
    working = re.sub(r"\.[\w-]+", "", working)
    pseudo_classes = re.findall(r":[\w-]+", working)
    working = re.sub(r":[\w-]+", "", working).strip()
    tag = "" if working in {"", "*"} else working
    if tag and not re.fullmatch(r"[a-zA-Z][\w-]*", tag):
        raise ValueError(f"unsupported modeled compound {compound!r}")
    return {
        "tag": tag,
        "ids": set(ids),
        "classes": set(classes),
        "attributes": set(attributes),
        "pseudo_classes": set(pseudo_classes),
        "pseudo_elements": set(pseudo_elements),
        "functions": set(functions),
    }


def modeled_compound_matches(rule_compound: str, target_compound: str) -> bool:
    rule = modeled_compound_constraints(rule_compound)
    target = modeled_compound_constraints(target_compound)
    if rule["tag"] and rule["tag"] != target["tag"]:
        return False
    if rule["pseudo_elements"] != target["pseudo_elements"]:
        return False
    for key in [
        "ids",
        "classes",
        "attributes",
        "pseudo_classes",
        "functions",
    ]:
        if not rule[key].issubset(target[key]):
            return False
    return True


def modeled_selector_matches(rule_selector: str, target_selector: str) -> bool:
    rule_compounds, rule_combinators = modeled_selector_chain(rule_selector)
    target_compounds, _ = modeled_selector_chain(target_selector)
    rule_index = len(rule_compounds) - 1
    target_index = len(target_compounds) - 1
    if not modeled_compound_matches(
        rule_compounds[rule_index], target_compounds[target_index]
    ):
        return False

    while rule_index > 0:
        combinator = rule_combinators[rule_index - 1]
        rule_index -= 1
        target_index -= 1
        if combinator == ">":
            if target_index < 0 or not modeled_compound_matches(
                rule_compounds[rule_index], target_compounds[target_index]
            ):
                return False
            continue
        while target_index >= 0 and not modeled_compound_matches(
            rule_compounds[rule_index], target_compounds[target_index]
        ):
            target_index -= 1
        if target_index < 0:
            return False
    return True


def modeled_selector_specificity(selector: str) -> tuple[int, int, int]:
    ids = classes = elements = 0
    compounds, _ = modeled_selector_chain(selector)
    for compound in compounds:
        constraints = modeled_compound_constraints(compound)
        ids += len(constraints["ids"])
        classes += (
            len(constraints["classes"])
            + len(constraints["attributes"])
            + len(constraints["pseudo_classes"])
        )
        elements += bool(constraints["tag"]) + len(
            constraints["pseudo_elements"]
        )
        for function in constraints["functions"]:
            match = re.fullmatch(r"(:{1,2})([\w-]+)\((.*)\)", function)
            assert match
            prefix, name, arguments = match.groups()
            if prefix == "::":
                elements += 1
            elif name == "where":
                continue
            elif name in {"is", "not", "has"}:
                argument_specificities = [
                    modeled_selector_specificity(argument)
                    for argument in split_modeled_selector_list(arguments)
                ]
                nested_ids, nested_classes, nested_elements = max(
                    argument_specificities
                )
                ids += nested_ids
                classes += nested_classes
                elements += nested_elements
            else:
                classes += 1
    return ids, classes, elements


def modeled_author_cascade_value(css: str, selector: str, property_name: str) -> str:
    """Return a winner in the contract's constrained author-CSS model.

    The model covers grouped author rules, type/class/id/attribute selectors,
    pseudo-classes/elements, non-nested :is/:not/:has/:where specificity,
    descendant and child chains, !important, specificity, declaration order,
    and source order. The caller supplies one concrete selector witness
    containing every ancestor and state needed by applicable rules.

    This is intentionally not a browser cascade: it does not resolve a DOM,
    sibling combinators, CSS escapes/nesting, layers/origins/inline styles,
    inheritance, shorthands, or whether media/container/supports rules are
    active. Contract callers use it only for the supported static ownership
    cases and must not infer runtime behavior outside that scope.
    """
    css_without_comments = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
    candidates: list[tuple[tuple[bool, tuple[int, int, int], int, int], str]] = []
    rules = re.finditer(r"([^{}]+)\{([^{}]*)\}", css_without_comments, re.DOTALL)
    for rule_order, rule in enumerate(rules):
        selector_group, body = rule.groups()
        for rule_selector in split_modeled_selector_list(selector_group):
            if rule_selector.startswith("@") or not modeled_selector_matches(
                rule_selector, selector
            ):
                continue
            specificity = modeled_selector_specificity(rule_selector)
            for declaration_order, value in enumerate(
                declarations_for_property(body, property_name)
            ):
                important = bool(
                    re.search(r"!important\s*$", value, flags=re.IGNORECASE)
                )
                candidates.append(
                    (
                        (important, specificity, rule_order, declaration_order),
                        value,
                    )
                )
    assert candidates, f"missing {property_name!r} ownership for {selector!r}"
    return max(candidates, key=lambda candidate: candidate[0])[1]


def media_query_block(css: str, query: str) -> str:
    marker = f"@media {query}"
    start = css.find(marker)
    assert start >= 0, f"missing media query {query!r}"
    opening = css.find("{", start + len(marker))
    assert opening >= 0
    depth = 1
    index = opening + 1
    while index < len(css) and depth:
        if css[index] == "{":
            depth += 1
        elif css[index] == "}":
            depth -= 1
        index += 1
    assert depth == 0, f"unterminated media query {query!r}"
    return css[opening + 1 : index - 1]


def test_modeled_author_cascade_detects_later_higher_specificity_winner():
    css = """
    .fixture button.primary { color: expected; }
    .fixture .toolbar button.primary { color: override; }
    """

    assert (
        modeled_author_cascade_value(
            css, ".fixture .toolbar button.primary.feature", "color"
        )
        == "override"
    )


def test_modeled_author_cascade_detects_applicable_important_winner():
    css = """
    .fixture button.primary { color: override !important; }
    .fixture .toolbar button.primary.feature { color: expected; }
    """

    assert (
        modeled_author_cascade_value(
            css, ".fixture .toolbar button.primary.feature", "color"
        )
        == "override !important"
    )


def test_modeled_author_cascade_uses_source_order_after_equal_specificity():
    css = """
    .fixture .toolbar button.primary { color: first; }
    .fixture .panel button.primary { color: second; }
    """

    assert (
        modeled_author_cascade_value(
            css, ".fixture .toolbar .panel button.primary.feature", "color"
        )
        == "second"
    )


def test_modeled_author_cascade_does_not_apply_element_rule_to_pseudo_element():
    css = """
    .fixture .handle { border-color: wrong !important; }
    .fixture .handle::after { border-color: expected; }
    """

    assert (
        modeled_author_cascade_value(
            css, ".fixture .handle::after", "border-color"
        )
        == "expected"
    )


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
        modeled_author_cascade_value(design_system, ".spark-ui .primary", "background")
        == "var(--hesh-orange)"
    )
    assert (
        modeled_author_cascade_value(design_system, ".spark-ui .primary", "color")
        == "var(--hesh-ink)"
    )
    assert (
        modeled_author_cascade_value(
            design_system, ".spark-ui .sidebar nav button.active", "background"
        )
        == "#edf2ff"
    )
    assert (
        modeled_author_cascade_value(
            design_system, ".spark-ui .sidebar nav button.active", "color"
        )
        == "var(--hesh-cobalt)"
    )
    assert (
        modeled_author_cascade_value(
            design_system, ".spark-ui button:focus-visible", "outline"
        )
        == "3px solid var(--hesh-cobalt)"
    )
    assert (
        modeled_author_cascade_value(
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
    app_css = active_app_css_without_disabled_legacy_block()
    author_css = active_frontend_author_css()

    for selector in [
        ".spark-ui .entity-card-actions button.entity-edit-button",
        ".spark-ui .entity-card-actions .template-open-button.entity-edit-button",
        ".spark-ui .account-quickstart-card > button",
    ]:
        assert (
            modeled_author_cascade_value(author_css, selector, "background")
            == "var(--hesh-orange)"
        )
        assert (
            modeled_author_cascade_value(author_css, selector, "color")
            == "var(--hesh-ink)"
        )

    for selector in [
        ".spark-ui .account-quickstart-grid input",
        ".spark-ui .account-quickstart-grid select",
        ".spark-ui .account-quickstart-card > button",
    ]:
        assert (
            modeled_author_cascade_value(author_css, selector, "min-height")
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
            modeled_author_cascade_value(author_css, selector, "background")
            == "var(--spark-action-strong)"
        )
        assert (
            modeled_author_cascade_value(author_css, selector, "color")
            == "var(--hesh-ink)"
        )

    for selector in ["input:focus", "select:focus", "textarea:focus"]:
        focus_rules = rule_bodies_for_selector(app_css, selector)
        assert focus_rules
        assert all("#2563eb" not in body.lower() for body in focus_rules)
        assert (
            modeled_author_cascade_value(
                author_css, f".spark-ui {selector}", "border-color"
            )
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
            modeled_author_cascade_value(
                author_css, f".spark-ui {selector}", "outline"
            )
            == "3px solid var(--hesh-cobalt)"
        )


def test_hesh_v4_modeled_author_cascade_owns_select_focus():
    author_css = active_frontend_author_css()

    for select_focus in [
        ".spark-ui select:not([multiple]):focus:focus-visible",
        (
            ".spark-ui .project-switcher "
            "select:not([multiple]):focus:focus-visible"
        ),
        (
            ".spark-ui .account-quickstart-grid "
            "select:not([multiple]):focus:focus-visible"
        ),
    ]:
        assert (
            modeled_author_cascade_value(author_css, select_focus, "border-color")
            == "var(--hesh-cobalt) !important"
        )
        assert (
            modeled_author_cascade_value(author_css, select_focus, "outline")
            == "3px solid var(--hesh-cobalt)"
        )
        assert (
            modeled_author_cascade_value(author_css, select_focus, "outline-offset")
            == "2px"
        )


def test_hesh_v4_modeled_author_cascade_owns_compact_control_targets():
    author_css = active_frontend_author_css()

    for selector in [
        ".spark-ui .quick-test-command-grid button",
        ".spark-ui .connection-line button",
        ".spark-ui .launch-wizard-step button",
    ]:
        assert (
            modeled_author_cascade_value(author_css, selector, "min-height")
            == "var(--spark-control-height)"
        )

    assert (
        modeled_author_cascade_value(
            author_css, ".spark-ui .connection-line button", "width"
        )
        == "var(--spark-control-height)"
    )
    assert (
        modeled_author_cascade_value(
            author_css, ".spark-ui .connection-line button", "height"
        )
        == "var(--spark-control-height)"
    )


def test_hesh_v4_mobile_navigation_dashboard_and_guided_action_contracts():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")
    author_css = active_frontend_author_css()
    tablet = media_query_block(design_system, "(max-width: 980px)")
    phone = media_query_block(design_system, "(max-width: 640px)")

    for selector, property_name, expected in [
        (".spark-ui .sidebar", "height", "72px"),
        (".spark-ui .sidebar", "min-height", "72px"),
        (".spark-ui .sidebar", "max-height", "72px"),
        (".spark-ui .sidebar", "grid-template-rows", "72px"),
        (".spark-ui .sidebar", "overflow", "hidden"),
        (".spark-ui .mobile-nav-toggle", "display", "inline-flex"),
        (".spark-ui .sidebar:not(.mobile-nav-open) nav", "display", "none"),
        (
            ".spark-ui .gemini-widget-canvas",
            "grid-template-columns",
            "repeat(2, minmax(0, 1fr))",
        ),
        (".spark-ui .grid-cell", "grid-column", "span 1 !important"),
        (".spark-ui .demo-preview-banner", "display", "grid"),
        (
            ".spark-ui .demo-preview-banner",
            "grid-template-columns",
            "minmax(0, 1fr)",
        ),
    ]:
        assert (
            modeled_author_cascade_value(tablet, selector, property_name)
            == expected
        )

    for selector, property_name, expected in [
        (".spark-ui .sidebar.mobile-nav-open", "position", "fixed"),
        (".spark-ui .sidebar.mobile-nav-open", "inset", "0"),
        (".spark-ui .sidebar.mobile-nav-open", "width", "100%"),
        (".spark-ui .sidebar.mobile-nav-open", "height", "100dvh"),
        (".spark-ui .sidebar.mobile-nav-open", "min-height", "100dvh"),
        (".spark-ui .sidebar.mobile-nav-open", "max-height", "100dvh"),
        (
            ".spark-ui .sidebar.mobile-nav-open",
            "grid-template-rows",
            "72px minmax(0, 1fr) auto",
        ),
        (".spark-ui .sidebar.mobile-nav-open", "align-items", "stretch"),
        (".spark-ui .sidebar.mobile-nav-open", "overflow", "hidden"),
        (".spark-ui .sidebar.mobile-nav-open nav", "grid-row", "2"),
        (".spark-ui .sidebar.mobile-nav-open nav", "min-height", "0"),
        (".spark-ui .sidebar.mobile-nav-open nav", "max-height", "none"),
        (".spark-ui .sidebar.mobile-nav-open nav", "overflow-y", "auto"),
        (".spark-ui .sidebar.mobile-nav-open .session-card", "grid-row", "3"),
        ("body.hesh-mobile-nav-locked", "overflow", "hidden"),
    ]:
        assert (
            modeled_author_cascade_value(tablet, selector, property_name)
            == expected
        )

    assert (
        modeled_author_cascade_value(
            phone, ".spark-ui .gemini-widget-canvas", "grid-template-columns"
        )
        == "1fr"
    )

    for selector in [
        '[data-ui-mode="brand"] .starter-actions button',
        '[data-ui-mode="brand"] .starter-link-button',
    ]:
        assert (
            modeled_author_cascade_value(author_css, selector, "min-height")
            == "var(--spark-control-height)"
        )


def test_hesh_dashboard_readable_presentation_owns_tablet_inline_grid_geometry():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")
    laptop = media_query_block(design_system, "(max-width: 1180px)")
    narrow = media_query_block(design_system, "(max-width: 720px)")
    canvas = (
        ".spark-ui.dashboard-shell .dashboard-main "
        ".gemini-widget-canvas:not(.edit-mode)"
    )

    for property_name, expected in [
        ("display", "grid"),
        ("grid-template-columns", "repeat(2, minmax(0, 1fr))"),
        ("grid-auto-flow", "row"),
        ("grid-auto-rows", "auto"),
        ("align-items", "start"),
        ("height", "auto !important"),
        ("min-height", "0 !important"),
    ]:
        assert modeled_author_cascade_value(laptop, canvas, property_name) == expected

    for cell_class in [".grid-cell", ".react-grid-item"]:
        cell = f"{canvas} > {cell_class}"
        for property_name, expected in [
            ("position", "relative !important"),
            ("inset", "auto !important"),
            ("width", "auto !important"),
            ("height", "auto !important"),
            ("min-height", "0 !important"),
            ("min-width", "0"),
            ("transform", "none !important"),
            ("grid-column", "auto !important"),
            ("grid-row", "auto !important"),
            ("max-width", "100%"),
            ("align-self", "start"),
        ]:
            assert (
                modeled_author_cascade_value(laptop, cell, property_name)
                == expected
            )

        widget = f"{cell} > .widget"
        assert (
            modeled_author_cascade_value(laptop, widget, "height")
            == "auto !important"
        )
        assert (
            modeled_author_cascade_value(laptop, widget, "min-height")
            == "clamp(16rem, 32vw, 22rem)"
        )

    assert (
        modeled_author_cascade_value(narrow, canvas, "grid-template-columns")
        == "minmax(0, 1fr)"
    )


def test_hesh_v4_modeled_author_cascade_owns_accessible_primary_hovers():
    design_system = DESIGN_SYSTEM_CSS.read_text(encoding="utf-8")
    author_css = active_frontend_author_css()

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
            modeled_author_cascade_value(author_css, selector, "background")
            == "var(--spark-action-strong)"
        )
        assert (
            modeled_author_cascade_value(author_css, selector, "color")
            == "var(--hesh-ink)"
        )

    assert contrast_ratio(
        css_hex_token(design_system, "--spark-action-strong"),
        css_hex_token(design_system, "--hesh-ink"),
    ) >= 4.5


def test_hesh_v4_modeled_author_cascade_owns_selection():
    author_css = active_frontend_author_css()

    assert (
        modeled_author_cascade_value(
            author_css, ".spark-ui .builder-cell.selected", "outline"
        )
        == "3px solid color-mix(in srgb, var(--hesh-cobalt) 25%, transparent)"
    )
    assert (
        modeled_author_cascade_value(
            author_css,
            ".spark-ui .builder-cell.selected > .widget",
            "outline",
        )
        == "2px solid var(--hesh-cobalt)"
    )


def test_hesh_v4_modeled_author_cascade_owns_resize_handles():
    author_css = active_frontend_author_css()

    handle_after = ".spark-ui .react-grid-item > .react-resizable-handle::after"
    assert (
        modeled_author_cascade_value(author_css, handle_after, "border-right")
        == "3px solid var(--hesh-cobalt) !important"
    )
    assert (
        modeled_author_cascade_value(author_css, handle_after, "border-bottom")
        == "3px solid var(--hesh-cobalt) !important"
    )
    for selector in [
        ".spark-ui .react-grid-item > .react-resizable-handle-s::after",
        ".spark-ui .react-grid-item > .react-resizable-handle-n::after",
    ]:
        assert (
            modeled_author_cascade_value(author_css, selector, "border-bottom")
            == "3px solid var(--hesh-cobalt) !important"
        )
    assert (
        modeled_author_cascade_value(
            author_css,
            ".spark-ui .react-grid-item > .react-resizable-handle-e::after",
            "border-right",
        )
        == "3px solid var(--hesh-cobalt) !important"
    )


def test_hesh_v4_modeled_author_cascade_owns_dashboard_grid_and_overflow():
    author_css = active_frontend_author_css()

    dashboard_grid = (
        ".spark-ui.dashboard-shell .product-header-grid.dashboard-header-grid"
    )
    assert (
        " ".join(
            modeled_author_cascade_value(
                author_css, dashboard_grid, "grid-template-areas"
            )
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
        assert (
            modeled_author_cascade_value(author_css, selector, "overflow")
            == "visible"
        )


def test_template_studio_canvas_label_does_not_claim_online_health_semantics():
    author_css = active_frontend_author_css()
    page = TEMPLATE_STUDIO_PAGE.read_text(encoding="utf-8")

    assert 'className="pill mode-pill">Actual dashboard canvas' in page
    assert 'className="pill online-pill">Actual dashboard canvas' not in page
    assert (
        modeled_author_cascade_value(
            author_css, ".spark-ui .mode-pill", "background"
        )
        == "var(--spark-primary-soft)"
    )
    assert (
        modeled_author_cascade_value(author_css, ".spark-ui .mode-pill", "color")
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
