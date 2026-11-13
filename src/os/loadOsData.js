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

const APPLICATIONS_FIXTURE = [
  {
    id: 'app-demo',
    company: 'Acme',
    roleTitle: 'Frontend Engineer',
    link: 'https://jobs.acme.example/fe',
    notes: 'Portfolio-safe fixture',
    status: 'applied',
  },
];

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

export async function loadApplications() {
  if (isAgentHttpConfigured()) return agentFetch('/applications');
  return structuredClone(APPLICATIONS_FIXTURE);
}

export async function upsertApplication(application) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to save Applications');
  }
  return agentFetch('/applications', { method: 'PUT', body: application });
}

export async function deleteApplication(id) {
  if (!isAgentHttpConfigured()) {
    throw new Error('Connect VITE_AGENT_HTTP_URL to delete Applications');
  }
  return agentFetch(`/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
