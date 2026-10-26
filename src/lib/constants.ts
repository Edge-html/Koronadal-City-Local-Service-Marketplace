import type { Tone } from "@/components/ui";

/**
 * General household service categories and Koronadal City barangays.
 */

export interface Category {
  id: string;
  name: string;
  scope: string;
  useCases: string;
  /** Typical price band in PHP, used as a floor reference for anti-exploitation. */
  floor: number;
  /** Admin-controlled availability in the service picker. */
  enabled?: boolean;
}

export const CATEGORIES: Category[] = [
  {
    id: "carpentry",
    name: "Carpentry",
    scope:
      "Structural woodwork, framing, custom cabinetry, door/window fitting, and furniture repair.",
    useCases:
      "Repairing ceiling joists, installing flush doors, building built-in kitchen cabinets.",
    floor: 800,
  },
  {
    id: "plumbing",
    name: "Plumbing & Water Services",
    scope:
      "Piping installation, leak diagnostics, fixture mounting, drainage unclogging, and water tank servicing.",
    useCases:
      "Fixing pressurized line leaks, installing toilet bowls, clearing blocked septic connections.",
    floor: 500,
  },
  {
    id: "electrical",
    name: "Electrical Services",
    scope:
      "Residential wiring, breaker panel upgrades, short-circuit troubleshooting, lighting fixture installation.",
    useCases:
      "Rewiring renovated room extensions, fixing tripping main breakers, installing outlet networks.",
    floor: 600,
  },
  {
    id: "aircon-appliance",
    name: "Aircon & Appliance Repair",
    scope:
      "Air conditioning cleaning/freon recharge, refrigerator maintenance, washing machine diagnostics.",
    useCases:
      "Split-type AC chemical cleaning, washing machine motor replacement, refrigerator compressor repair.",
    floor: 700,
  },
  {
    id: "masonry",
    name: "Masonry & Concrete Repair",
    scope:
      "Block laying, plastering, tile setting, concrete cracking repair, perimeter wall construction.",
    useCases:
      "Laying floor tiles, rendering wall surfaces, repairing damaged concrete driveways.",
    floor: 900,
  },
  {
    id: "roofing",
    name: "Roofing & Leak Sealing",
    scope:
      "Corrugated sheet replacement, gutter clearing/installation, waterproofing coat application, roof flashing repair.",
    useCases:
      "Sealing ridge cap leaks during monsoon season, clearing downspouts, re-tapping roof screws.",
    floor: 1200,
  },
  {
    id: "painting",
    name: "House Painting",
    scope:
      "Interior and exterior surface preparation, priming, finish painting, wood staining, anti-rust coating.",
    useCases:
      "Exterior wall repainting, gate rust treatment and painting, interior room coats.",
    floor: 1500,
  },
  {
    id: "welding",
    name: "Welding & Metalwork",
    scope:
      "Fabrication, structural iron welding, window grill repair, main gate realignment, metal frame assembly.",
    useCases:
      "Welding broken gate hinges, fabricating window security grilles, steel truss spot repairs.",
    floor: 750,
  },
  {
    id: "mechanical",
    name: "Small Engine & Motorcycle Mechanics",
    scope:
      "On-site tune-ups, carburetor cleaning, engine oil changes, brake overhaul, small pump maintenance.",
    useCases:
      "Home servicing of commuter motorcycles, generator engine tune-ups, water pump fixes.",
    floor: 300,
  },
  {
    id: "groundskeeping",
    name: "General Yard & Grounds Maintenance",
    scope:
      "Tree trimming, lawn mowing, brush clearing, perimeter debris management, landscape cleanup.",
    useCases:
      "Cutting overgrown mango trees near power lines, lot clearing, lawn turf trimming.",
    floor: 400,
  },
  {
    id: "home-cleaning",
    name: "Home Cleaning & Laundry",
    scope: "Home cleaning, laundry, ironing, and household upkeep.",
    useCases: "Room cleaning, move-in cleaning, laundry, and ironing.",
    floor: 300,
  },
  {
    id: "beauty-care",
    name: "Beauty & Personal Care",
    scope: "At-home grooming and personal care services.",
    useCases: "Hair rebonding, haircutting, manicure, and pedicure.",
    floor: 250,
  },
  {
    id: "tutoring",
    name: "Tutoring & Lessons",
    scope: "Academic tutoring and practical lessons for children and adults.",
    useCases: "Reading support, math tutoring, and music lessons.",
    floor: 300,
  },
  {
    id: "computer-phone",
    name: "Computer & Phone Help",
    scope: "Basic device setup, troubleshooting, and repair services.",
    useCases: "Computer setup, software troubleshooting, and phone repair.",
    floor: 300,
  },
  {
    id: "moving-errands",
    name: "Moving & Household Help",
    scope: "Household assistance, moving help, and local errands.",
    useCases: "Furniture moving, packing help, and household errands.",
    floor: 300,
  },
];

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<string, Category>;

/** Predefined profile skills workers can select without typing. */
export const SKILLS_BY_CATEGORY: Record<string, string[]> = {
  carpentry: ["Furniture repair", "Door installation", "Cabinet making", "Roof framing", "Wood framing", "Ceiling repair", "Custom shelving", "Window fitting"],
  plumbing: ["Leak repair", "Faucet installation", "Toilet installation", "Drain unclogging", "Pipe installation", "Water tank servicing", "Shower repair", "Septic line clearing"],
  electrical: ["Lighting installation", "Outlet installation", "Wiring repair", "Breaker troubleshooting", "Ceiling fan installation", "Panel upgrades", "Short-circuit diagnosis", "Conduit installation"],
  "aircon-appliance": ["Aircon cleaning", "Aircon repair", "Refrigerator repair", "Washing machine repair", "Freon recharge", "Appliance diagnostics", "Small appliance repair", "Preventive maintenance"],
  masonry: ["Tile setting", "Wall plastering", "Concrete repair", "Block laying", "Cement finishing", "Grouting", "Driveway repair", "Wall construction"],
  roofing: ["Roof leak repair", "Roof sheet installation", "Gutter cleaning", "Gutter installation", "Waterproofing", "Roof flashing repair", "Ridge cap sealing", "Roof inspection"],
  painting: ["Interior painting", "Exterior painting", "Surface preparation", "Wall priming", "Wood staining", "Gate painting", "Anti-rust coating", "Repainting"],
  welding: ["Gate repair", "Metal fabrication", "Window grills", "Steel frame assembly", "Hinge repair", "Metal cutting", "Structural welding", "Custom metalwork"],
  mechanical: ["Motorcycle tune-up", "Oil change", "Brake repair", "Carburetor cleaning", "Generator repair", "Water pump repair", "Engine diagnostics", "Small engine maintenance"],
  groundskeeping: ["Lawn mowing", "Tree trimming", "Brush clearing", "Land clearing", "Garden cleanup", "Hedge trimming", "Debris removal", "Basic landscaping"],
  "home-cleaning": ["Home cleaning", "Deep cleaning", "Laundry", "Ironing", "Move-in cleaning", "Kitchen cleaning"],
  "beauty-care": ["Manicure", "Pedicure", "Hair rebonding", "Haircut", "Hair coloring", "Makeup"],
  tutoring: ["Math tutoring", "Reading lessons", "English tutoring", "Science tutoring", "Music lessons", "Homework support"],
  "computer-phone": ["Computer setup", "Device troubleshooting", "Phone repair", "Software installation", "Wi-Fi setup"],
  "moving-errands": ["Packing", "Furniture moving", "Household help", "Local errands", "Assembly help"],
};

export const BARANGAYS = [
  "Assumption (Bulol)",
  "Avanceña (Barrio III)",
  "Cacub",
  "Caloocan",
  "Carpenter Hill",
  "Concepcion (Barrio VI)",
  "Esperanza",
  "General Paulino Santos (Barrio I)",
  "Mabini",
  "Magsaysay",
  "Mambucal",
  "Morales",
  "Namnama",
  "New Pangasinan (Barrio IV)",
  "Paraiso",
  "Rotonda",
  "San Isidro",
  "San Jose (Barrio V)",
  "San Roque",
  "Santa Cruz",
  "Santo Niño (Barrio II)",
  "Saravia (Barrio VIII)",
  "Topland (Barrio VII / Zulueta)",
  "Zone I (Poblacion)",
  "Zone II (Poblacion)",
  "Zone III (Poblacion)",
  "Zone IV (Poblacion)",
] as const;

/** Walk-in assisted onboarding service points. */
export const SERVICE_POINTS = [
  "Barangay Desk Kiosk — participating Barangay Halls",
  "PESO Desk Support — PESO Koronadal branch",
];

export const WALLET_TOPUP_METHODS = [
  {
    id: "gcash",
    name: "GCash",
    detail: "Pay the official account shown below, then submit your receipt for administrator verification.",
  },
  {
    id: "cliqq",
    name: "7-Eleven (CliQQ) Terminals / App",
    detail: "Pay through CliQQ, then submit the receipt for administrator verification.",
  },
] as const;

export const ONBOARDING_PATHWAYS = [
  {
    id: "walk-in",
    name: "Walk-In Assisted Onboarding",
    detail:
      "For workers who prefer in-person registration or require digital literacy assistance.",
    points: SERVICE_POINTS,
  },
  {
    id: "digital",
    name: "Digital Self-Registration (3-Step)",
    detail: "Register from any mobile device, then submit credentials for review.",
    points: [
      "Step 1 — Identity & contact creation",
      "Step 2 — Document upload",
      "Step 3 — Verification & activation",
    ],
  },
] as const;

/** The six-stage lifecycle, rendered as a stepper across the product UI. */
export const WORKFLOW_STAGES = [
  {
    step: 1,
    key: "browse",
    name: "Browse & Select",
    detail:
      "Consumers browse worker profiles filtered by category, location (Barangay), average star rating, and verified badges.",
  },
  {
    step: 2,
    key: "requested",
    name: "Request Sent",
    detail:
      "The consumer selects a worker and inputs a basic service description with an optional photo. The request appears in the worker's dashboard.",
  },
  {
    step: 3,
    key: "accepted",
    name: "Worker Accepts",
    detail:
      "Once the worker accepts, a private job conversation is available to both sides.",
  },
  {
    step: 4,
    key: "quoted",
    name: "Agree in Chat",
    detail:
      "The household and worker discuss the exact scope, service rate, schedule, materials, and payment method in their private chat. Each confirms the plan before work starts.",
  },
  {
    step: 5,
    key: "completed",
    name: "Complete the Work",
    detail:
      "The worker marks the agreed work complete. The household pays the worker directly using the method both sides chose.",
  },
  {
    step: 6,
    key: "reviewed",
    name: "Review & Portfolio",
    detail:
      'The worker may upload "Before & After" photos to enrich their public portfolio. The consumer receives an automated link to leave a 1-to-5 star rating and text review.',
  },
] as const;

/**
 * Job stage to badge tone.
 *
 * The tones are ordered by how loudly they should read, and the order was set
 * by what each stage asks of the user rather than by an arbitrary sequence:
 *
 *   quoted       a legacy request that still needs agreement confirmation
 *   requested    a worker must accept or decline
 *   disputed     something is wrong and someone has to look at it
 *   in_progress  work is happening; no decision needed
 *   completed    work finished
 *   reviewed     done
 *   cancelled    closed without work happening
 */
export const JOB_STATUS_META: Record<
  string,
  { label: string; tone: Tone }
> = {
  requested: { label: "Requested", tone: "new" },
  accepted: { label: "Accepted", tone: "active" },
  quoted: { label: "Agreement Needed", tone: "action" },
  in_progress: { label: "In Progress", tone: "active" },
  completed: { label: "Completed", tone: "neutral" },
  reviewed: { label: "Reviewed", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "muted" },
  disputed: { label: "Disputed", tone: "alert" },
};

/** Regulatory framework surfaced on the landing page and in terms. */
export const COMPLIANCE_FRAMEWORK = [
  {
    title: "Philippine Labor Code",
    subtitle: "Intermediary platform status",
    body: "The platform operates as an independent technology intermediary connecting service contractors with clients. It does not establish an employer-employee relationship, ensuring workers retain complete autonomy over their working schedules, accepted jobs, and operating methods.",
  },
  {
    title: "Clear service agreements",
    subtitle: "Scope, rate, schedule, and payment",
    body: "Households and workers discuss the job details in private chat and both confirm before work starts. The final service rate and payment method are agreed directly between them.",
  },
  {
    title: "Data Privacy Act of 2012",
    subtitle: "Republic Act No. 10173",
    body: "All personally identifiable information, clearance documents, and contact details are encrypted and stored in full compliance with National Privacy Commission mandates. Direct contact details are masked and only revealed to counterparties once a job request is formally accepted.",
  },
  {
    title: "Consumer Protection Act",
    subtitle: "Republic Act No. 7394",
    body: "Job details and the agreed rate can be reviewed in the conversation before work starts. Users can report a problem through the platform.",
  },
];

export const FAIR_COMPETITION_PRINCIPLES = [
  {
    title: "Workers set service rates",
    body: "Workers show a starting service rate. The worker and household agree on the final scope and price in chat.",
  },
  {
    title: "Single-tier referrals only",
    body: "Transparent referral systems prevent MLM-style structures, limiting rewards strictly to single-tier, job-verified invites.",
  },
  {
    title: "Reviews follow completed jobs",
    body: "Households can leave a rating and written review after the worker marks an agreed job complete.",
  },
];
