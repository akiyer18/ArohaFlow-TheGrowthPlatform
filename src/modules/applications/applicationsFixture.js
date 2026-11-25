/**
 * Placeholder Applications for local mode, built relative to a date.
 * Company names are the usual fictional placeholders; no real records.
 */
import { addDays } from './rules.js';

export function buildApplicationsFixture(today) {
  const d = (n) => addDays(today, n);
  const applications = [
    { id: 'app-acme', company: 'Acme Corp', role: 'Platform Engineer', stage: 'interviewing', appliedOn: d(-18), stageChangedOn: d(-6), nextStep: 'Technical interview, system design', nextStepDue: d(2), source: 'Referral' },
    { id: 'app-globex', company: 'Globex', role: 'Backend Engineer', stage: 'applied', appliedOn: d(-14), stageChangedOn: d(-14), source: 'Careers page' },
    { id: 'app-initech', company: 'Initech', role: 'Full-stack Developer', stage: 'applied', appliedOn: d(-5), stageChangedOn: d(-5), nextStep: 'Send portfolio link to recruiter', nextStepDue: d(-1) },
    { id: 'app-contoso', company: 'Contoso', role: 'Software Engineer II', stage: 'saved', stageChangedOn: d(-2), nextStep: 'Tailor CV and apply', nextStepDue: d(0), url: 'https://example.com/jobs/contoso' },
    { id: 'app-fabrikam', company: 'Fabrikam', role: 'Data Engineer', stage: 'offer', appliedOn: d(-30), stageChangedOn: d(-1), nextStep: 'Reply to offer', nextStepDue: d(5) },
    { id: 'app-northwind', company: 'Northwind', role: 'DevOps Engineer', stage: 'closed', closedReason: 'Rejected', appliedOn: d(-25), stageChangedOn: d(-9) },
  ].map((a) => ({ url: null, location: null, source: null, closedReason: null, appliedOn: null, nextStep: null, nextStepDue: null, notes: null, actionId: null, ...a }));

  const events = [
    { applicationId: 'app-acme', fromStage: 'applied', toStage: 'interviewing', onDate: d(-6) },
    { applicationId: 'app-fabrikam', fromStage: 'interviewing', toStage: 'offer', onDate: d(-1) },
    { applicationId: 'app-contoso', fromStage: null, toStage: 'saved', onDate: d(-2) },
    { applicationId: 'app-northwind', fromStage: 'applied', toStage: 'closed', onDate: d(-9) },
  ];
  return { applications, events };
}
