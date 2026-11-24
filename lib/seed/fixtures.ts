/**
 * Mock-mode fixtures. Fictional companies on the reserved .example TLD, so nothing here
 * can be mistaken for (or sent to) a real prospect. Shapes match the live adapters exactly.
 */
import type { SearchResult } from "@/lib/providers/tavily";

export interface DemoCompany {
  key: string; name: string; domain: string; industry: string; naics: string; headcount: number; region: string;
  hunterHq: string | null; apolloHq: string | null;
  signals: { type: "hiring" | "funding" | "launch" | "leadership_change" | "tech_adoption" | "expansion" | "negative"; summary: string; path: string }[];
  people: { first: string; last: string; title: string; seniority: string; hunterEmail: boolean; hunterStatus: "valid" | "accept_all" | "invalid" | "unknown"; hunterLinkedin: boolean; apolloEmail: boolean; apolloLinkedin: boolean; previouslyAt?: string }[];
  fit: number; intent: number; excludeReason?: string;
}

export const DEMO_PRODUCT = {
  name: "Ledgerlight",
  description: "Ledgerlight automates the month-end close for mid-market finance teams: it reconciles bank feeds, flags anomalies and drafts journal entries inside NetSuite and Sage Intacct, cutting close time from 10 days to 3.",
  customers: "Controllers and CFOs at 200 to 2,000 person companies running NetSuite or Sage Intacct",
  pricing: "$1,500 to $6,000 per month, by entity count",
  constraints: "SOC 2 Type II; US and UK only",
  teamBackground: "Co-founder Maya Chen was a finance systems lead at Stratus Data; CTO studied at Carnegie Mellon",
  regions: ["United States", "United Kingdom"],
  excludeRegions: ["EU (GDPR review pending)"],
};

export const DEMO_ICP = {
  industries: [
    { name: "Software publishers", naics: "513210", confidence: 0.86 },
    { name: "Freight transportation arrangement", naics: "488510", confidence: 0.71 },
    { name: "Offices of physicians (multi-entity groups)", naics: "621111", confidence: 0.58 },
  ],
  companySize: { value: { minEmployees: 200, maxEmployees: 2000 }, confidence: 0.82 },
  regions: { value: ["United States", "United Kingdom"], confidence: 0.9 },
  personas: [
    { title: "CFO", seniority: "c_level", confidence: 0.8 },
    { title: "VP Finance", seniority: "vp", confidence: 0.77 },
    { title: "Controller", seniority: "director", confidence: 0.84 },
  ],
  triggers: [
    { signal: "Hiring accountants or finance data engineers", confidence: 0.79 },
    { signal: "ERP migration to NetSuite or Sage Intacct", confidence: 0.74 },
    { signal: "New CFO in the last 6 months", confidence: 0.66 },
    { signal: "M&A adding legal entities", confidence: 0.61 },
  ],
  negativeSignals: ["Hiring freeze or layoffs", "Uses a direct competitor signed in the last 12 months", "HQ in the EU"],
};

export const DEMO_TEAM = [
  { id: "team_maya", name: "Maya Chen", role: "Co-founder, CEO", previouslyAt: "Stratus Data", school: "UC Berkeley" },
  { id: "team_arjun", name: "Arjun Rao", role: "Co-founder, CTO", previouslyAt: "Plaid", school: "Carnegie Mellon" },
];

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    key: "northwind", name: "Northwind Analytics", domain: "northwind-analytics.example", industry: "Software publishers", naics: "513210",
    headcount: 640, region: "United States", hunterHq: "Austin, TX, US", apolloHq: "Austin, Texas, United States", fit: 88, intent: 92,
    signals: [
      { type: "hiring", summary: "Hiring 3 finance data engineers and a Senior Accountant (close process)", path: "/careers/finance-data-engineer" },
      { type: "funding", summary: "Raised a $45M Series C to expand into the UK", path: "/news/series-c" },
    ],
    people: [
      { first: "Priya", last: "Natarajan", title: "VP Finance", seniority: "vp", hunterEmail: true, hunterStatus: "valid", hunterLinkedin: true, apolloEmail: true, apolloLinkedin: true, previouslyAt: "Stratus Data" },
      { first: "Tom", last: "Becker", title: "Controller", seniority: "director", hunterEmail: true, hunterStatus: "accept_all", hunterLinkedin: false, apolloEmail: true, apolloLinkedin: true },
    ],
  },
  {
    key: "brightpath", name: "Brightpath Logistics", domain: "brightpath-logistics.example", industry: "Freight transportation arrangement", naics: "488510",
    headcount: 1200, region: "United States", hunterHq: null, apolloHq: "Columbus, Ohio, United States", fit: 81, intent: 74,
    signals: [
      { type: "tech_adoption", summary: "Migrated from QuickBooks to NetSuite (implementation partner case study)", path: "/blog/netsuite-go-live" },
      { type: "leadership_change", summary: "Appointed Dana Ortiz as CFO", path: "/press/new-cfo" },
    ],
    people: [
      { first: "Dana", last: "Ortiz", title: "Chief Financial Officer", seniority: "c_level", hunterEmail: false, hunterStatus: "unknown", hunterLinkedin: false, apolloEmail: true, apolloLinkedin: true },
    ],
  },
  {
    key: "halcyon", name: "Halcyon Health Partners", domain: "halcyon-health.example", industry: "Offices of physicians", naics: "621111",
    headcount: 900, region: "United States", hunterHq: "Nashville, TN, US", apolloHq: "Nashville, Tennessee, United States", fit: 72, intent: 61,
    signals: [{ type: "expansion", summary: "Acquired two clinic groups, adding 4 legal entities", path: "/news/acquisition" }],
    people: [
      { first: "Marcus", last: "Hale", title: "Corporate Controller", seniority: "director", hunterEmail: true, hunterStatus: "valid", hunterLinkedin: true, apolloEmail: true, apolloLinkedin: true },
    ],
  },
  {
    key: "corvid", name: "Corvid Robotics", domain: "corvid-robotics.example", industry: "Industrial machinery manufacturing", naics: "333249",
    headcount: 380, region: "United States", hunterHq: "Pittsburgh, PA, US", apolloHq: "Pittsburgh, Pennsylvania, United States", fit: 64, intent: 70,
    signals: [{ type: "hiring", summary: "Hiring a Head of FP&A to prepare for audit", path: "/jobs/head-of-fpa" }],
    people: [
      { first: "Elena", last: "Sousa", title: "Head of Finance", seniority: "director", hunterEmail: true, hunterStatus: "valid", hunterLinkedin: false, apolloEmail: true, apolloLinkedin: false },
    ],
  },
  {
    key: "tessellate", name: "Tessellate Retail Group", domain: "tessellate-retail.example", industry: "Clothing stores", naics: "458110",
    headcount: 1800, region: "United Kingdom", hunterHq: "Manchester, GB", apolloHq: "Manchester, England, United Kingdom", fit: 58, intent: 45,
    signals: [{ type: "launch", summary: "Opened 12 new stores, finance team reports slower close", path: "/investors/half-year-report" }],
    people: [
      { first: "Oliver", last: "Grant", title: "Finance Director", seniority: "director", hunterEmail: true, hunterStatus: "invalid", hunterLinkedin: true, apolloEmail: false, apolloLinkedin: true },
    ],
  },
  {
    key: "quillon", name: "Quillon Bio", domain: "quillon-bio.example", industry: "Biotechnology research", naics: "541714",
    headcount: 260, region: "United States", hunterHq: "Cambridge, MA, US", apolloHq: "Cambridge, Massachusetts, United States", fit: 52, intent: 38,
    signals: [{ type: "funding", summary: "Closed $30M Series B", path: "/news/series-b" }],
    people: [
      { first: "Grace", last: "Liu", title: "Controller", seniority: "director", hunterEmail: true, hunterStatus: "valid", hunterLinkedin: true, apolloEmail: true, apolloLinkedin: true },
    ],
  },
  {
    key: "marlow", name: "Marlow Freight", domain: "marlow-freight.example", industry: "General freight trucking", naics: "484121",
    headcount: 700, region: "United States", hunterHq: "Memphis, TN, US", apolloHq: "Memphis, Tennessee, United States", fit: 77, intent: 20,
    excludeReason: "Negative signal: company-wide hiring freeze announced",
    signals: [{ type: "negative", summary: "Announced a company-wide hiring freeze and cost review", path: "/news/hiring-freeze" }],
    people: [
      { first: "Sam", last: "Okafor", title: "VP Finance", seniority: "vp", hunterEmail: true, hunterStatus: "valid", hunterLinkedin: true, apolloEmail: true, apolloLinkedin: true },
    ],
  },
];

export const DEMO_COMPETITORS = [
  { name: "FloQast", domain: "floqast.com", category: "direct" as const, positioning: "Close management checklists and reconciliations", pricing: "Per seat, quote-based", ourAdvantage: "Drafts journal entries, not only checklists; priced by entity, not seat" },
  { name: "BlackLine", domain: "blackline.com", category: "direct" as const, positioning: "Enterprise financial close and consolidation", pricing: "Enterprise contracts", ourAdvantage: "Live in two weeks for mid-market, not a six-month rollout" },
  { name: "Spreadsheets + ERP", domain: "netsuite.com", category: "status_quo" as const, positioning: "Manual close in Excel on top of the ERP", pricing: "Staff time", ourAdvantage: "Cuts close from about 10 days to 3" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export const MOCK_SEARCH_RESULTS: SearchResult[] = [
  ...DEMO_COMPANIES.flatMap((c) =>
    c.signals.map((s, i) => ({
      url: `https://${c.domain}${s.path}`,
      title: `${c.name}: ${s.summary}`,
      content: `${c.name} (${c.industry}, about ${c.headcount} employees, ${c.region}). ${s.summary}.`,
      score: 0.9 - i * 0.1,
    })),
  ),
  ...DEMO_COMPETITORS.map((c) => ({
    url: `https://${c.domain}/`,
    title: `${c.name} alternatives and competitors: ${c.positioning}`,
    content: `${c.name}: ${c.positioning}. Pricing: ${c.pricing}.`,
    score: 0.5,
  })),
];

function findPerson(domain: string, first: string, last: string) {
  const c = DEMO_COMPANIES.find((x) => x.domain === domain);
  return { c, p: c?.people.find((x) => slug(x.first) === slug(first) && slug(x.last) === slug(last)) };
}

export function mockPersonContact(domain: string, first: string, last: string) {
  const { p } = findPerson(domain, first, last);
  const email = `${slug(first)}.${slug(last)}@${domain}`;
  const li = `https://www.linkedin.com/in/${slug(first)}-${slug(last)}-demo`;
  return {
    hunterEmail: p?.hunterEmail ? email : null,
    hunterStatus: (p?.hunterEmail ? p.hunterStatus : "unknown") as "valid" | "accept_all" | "invalid" | "unknown",
    hunterLinkedin: p?.hunterLinkedin ? li : null,
    apolloEmail: p?.apolloEmail ? email : null,
    apolloLinkedin: p?.apolloLinkedin ? li : null,
  };
}

export function mockCompanyInfo(domain: string) {
  const c = DEMO_COMPANIES.find((x) => x.domain === domain);
  return { hunterHq: c?.hunterHq ?? null, apolloHq: c?.apolloHq ?? null };
}
