export type PlanTierCode = "free" | "plus" | "pro" | "max" | "enterprise";

export type PlanTier = {
  code: PlanTierCode;
  name: string;
  price: string;
  purpose: string;
  shortDescription: string;
  usageHighlights: string[];
  featureHighlights: string[];
  support: string;
  cta: string;
  badge?: string;
};

export const planCatalog: PlanTier[] = [
  {
    code: "free",
    name: "Free",
    price: "RM0/month",
    purpose: "Learn Spark IoT",
    shortDescription: "Prototype with one board and a simple web/mobile dashboard.",
    usageHighlights: ["1 device", "1 project", "1 user", "40,000 messages/month", "7-day data retention"],
    featureHighlights: ["Core widgets", "Web dashboard", "Mobile dashboard", "Spark IoT branding"],
    support: "Community support",
    cta: "Start free",
  },
  {
    code: "plus",
    name: "Plus",
    price: "RM25/month",
    purpose: "Build complete IoT projects",
    shortDescription: "Create student, FYP and small customer systems with GPS, camera and scheduler widgets.",
    usageHighlights: ["3 devices", "3 projects", "1 user", "1,000,000 messages/month", "30-day data retention", "5 automations"],
    featureHighlights: ["Core widgets", "Smart widgets", "GPS map", "Camera", "Web dashboard", "Mobile dashboard"],
    support: "Standard support",
    cta: "Start Plus",
    badge: "Most popular",
  },
  {
    code: "pro",
    name: "Pro",
    price: "RM49/month",
    purpose: "Develop professional IoT solutions",
    shortDescription: "Higher limits, API access and priority support for developers and growing businesses.",
    usageHighlights: ["10 devices", "10 projects", "1 user", "10,000,000 messages/month", "90-day data retention", "20 automations"],
    featureHighlights: ["Core widgets", "Smart widgets", "Advanced widgets", "Full API access", "Priority support"],
    support: "Priority support",
    cta: "Start Pro",
  },
  {
    code: "max",
    name: "Max",
    price: "RM99/month",
    purpose: "Run commercial deployments",
    shortDescription: "Manage multiple sites and boards with team access, fleet tools and long-term data.",
    usageHighlights: ["30 devices", "30 projects", "10 users", "50,000,000 messages/month", "365-day data retention", "100 automations"],
    featureHighlights: ["Team collaboration", "User roles", "Advanced OTA", "Fleet device management", "Full API access"],
    support: "Priority support",
    cta: "Start Max",
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "Contact sales",
    purpose: "Scale for organizations and OEMs",
    shortDescription: "Custom IoT cloud for large deployments, white-label platforms and dedicated infrastructure.",
    usageHighlights: ["Custom devices", "Custom projects", "Custom users", "Custom message quota", "Custom retention", "Unlimited automations"],
    featureHighlights: ["All widgets", "White-label platform", "Custom domain", "Advanced security", "SLA", "Custom integrations"],
    support: "Dedicated technical support",
    cta: "Contact sales",
  },
];

export function normalizePlanCode(code?: string): PlanTierCode {
  const normalized = (code || "pro").toLowerCase();
  if (normalized === "starter") return "plus";
  if (["free", "plus", "pro", "max", "enterprise"].includes(normalized)) return normalized as PlanTierCode;
  return "pro";
}

export function findPlan(code?: string): PlanTier {
  return planCatalog.find((plan) => plan.code === normalizePlanCode(code)) ?? planCatalog[2];
}
