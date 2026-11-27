import { agentFetch, isAgentHttpConfigured } from './agentHttp';

const GOALS_FIXTURE = [
  {
    id: 'g-job',
    title: 'Land a role',
    actions: [
      {
        id: 'a-apps',
        title: 'Run applications pipeline',
        status: 'active',
        microactions: [
          { id: 'm1', title: 'Update Applications CRM', status: 'open' },
          { id: 'm2', title: 'Tailor one cover letter', status: 'open' },
        ],
      },
    ],
  },
];

const HABITS_FIXTURE = [
  { id: 'gym', label: 'Gym', scheduledDays: [1, 2, 3, 4, 5], timeAnchor: '07:00' },
];

const ALLOWLIST_FIXTURE = [
  { type: 'email', value: 'tutor@uni.ac.uk' },
  { type: 'domain', value: 'recruiters.example' },
];

const DISCOVERY_FIXTURE = {
  searchedAt: '2026-11-14T12:00:00.000Z',
  results: [
    {
      id: 'job-demo-acme',
      company: 'Acme',
      roleTitle: 'AI Engineer',
      link: 'https://jobs.acme.example/ai',
      description: 'Build evaluation pipelines for LLM products.',
      score: 4.4,
      postedAt: '2026-11-12',
      discoveredAt: '2026-11-14',
      liveness: 'open',
      alreadyInTracker: false,
      recencyDate: '2026-11-12',
    },
    {
      id: 'job-demo-maybe',
      company: 'MaybeCo',
      roleTitle: 'Data Scientist',
      link: 'https://jobs.maybeco.example/ds',
      description: 'Liveness uncertain — confirm before applying.',
      score: 4.0,
      postedAt: null,
      discoveredAt: '2026-11-13',
      liveness: 'uncertain',
      alreadyInTracker: false,
      recencyDate: '2026-11-13',
    },
  ],
};

const DISCOVERY_CV_FIXTURE = {
  listingId: 'job-demo-acme',
  sections: [
    {
      section: 'experience',
      suggestion: 'Lead with evaluation-harness ownership in recent roles.',
    },
  ],
  keywords: [
    {
      keyword: 'evaluation',
      experienceHint: 'Highlight offline eval / scoring language.',
    },
  ],
};

export async function loadGoals() {
  if (isAgentHttpConfigured()) return agentFetch('/goals');
  return structuredClone(GOALS_FIXTURE);
}

export async function upsertGoal(goal) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to save Goals');
  }
  return agentFetch('/goals', { method: 'PUT', body: goal });
}

export async function upsertAction(action) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to save Actions');
  }
  return agentFetch('/actions', { method: 'PUT', body: action });
}

export async function upsertMicroaction(microaction) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to save Microactions');
  }
  return agentFetch('/microactions', { method: 'PUT', body: microaction });
}

export async function loadWeeklyPlanProposal() {
  if (!isAgentHttpConfigured()) return null;
  return agentFetch('/weekly-plan');
}

export async function proposeWeeklyPlan(input) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to propose a Weekly Plan');
  }
  return agentFetch('/weekly-plan/propose', { method: 'POST', body: input });
}

export async function editWeeklyPlan(input) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to edit a Weekly Plan');
  }
  return agentFetch('/weekly-plan', { method: 'PUT', body: input });
}

export async function acceptWeeklyPlan(input = {}) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to accept a Weekly Plan');
  }
  return agentFetch('/weekly-plan/accept', { method: 'POST', body: input });
}

export async function scheduleMicroaction(input) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to schedule a Microaction');
  }
  return agentFetch('/schedule-microaction', { method: 'POST', body: input });
}

export async function loadHabits() {
  if (isAgentHttpConfigured()) return agentFetch('/habits');
  return structuredClone(HABITS_FIXTURE);
}

export async function upsertHabit(habit) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to save Habits');
  }
  return agentFetch('/habits', { method: 'PUT', body: habit });
}

export async function loadAllowlist() {
  if (isAgentHttpConfigured()) return agentFetch('/allowlist');
  return structuredClone(ALLOWLIST_FIXTURE);
}

export async function saveAllowlist(entries) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to save Sender Allowlist');
  }
  return agentFetch('/allowlist', { method: 'PUT', body: entries });
}

export async function refreshDiscovery() {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to refresh Discovery listings');
  }
  return agentFetch('/discovery/refresh', { method: 'POST' });
}

export async function loadStartups() {
  if (!isAgentHttpConfigured()) return { updatedAt: null, lastRun: null, companies: [] };
  return agentFetch('/startups');
}

export async function findStartups() {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to find startups');
  }
  return agentFetch('/startups/refresh', { method: 'POST' });
}

export async function setStartupStatus({ id, status }) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to update startups');
  }
  return agentFetch('/startups/status', { method: 'POST', body: { id, status } });
}

export async function runDiscoverySearch(input = {}) {
  if (isAgentHttpConfigured()) {
    return agentFetch('/discovery/search', { method: 'POST', body: input });
  }
  return structuredClone(DISCOVERY_FIXTURE);
}

export async function getDiscoveryCvSuggestions(listingId) {
  if (isAgentHttpConfigured()) {
    return agentFetch('/discovery/cv-suggestions', {
      method: 'POST',
      body: { listingId },
    });
  }
  return {
    ...structuredClone(DISCOVERY_CV_FIXTURE),
    listingId,
  };
}

