# Schema ID Default Audit & Fix

## Problem
Many models have `id String @id` without `@default(cuid())`, causing Prisma errors when creating records.

## Models That Need Fixing

All models with `id String @id` (without `@default(cuid())`) need to be updated to `id String @id @default(cuid())`.

## Already Fixed (Have @default(cuid()))
- `contact_analyses` (line 132)
- `Contact` (line 402)
- `products` (line 993) ✅ Just fixed
- `templates` (line 1167)

## Need Fixing (Missing @default(cuid()))

1. GoogleOAuthToken (line 12)
2. assessments (line 27)
3. bd_event_ops (line 54)
4. bd_eventop_intel (line 87)
5. bd_intels (line 112) - Legacy, but still needs fix
6. bdos_scores (line 153)
7. blogs (line 175)
8. campaigns (line 192)
9. client_uploads (line 238)
10. companies (line 251)
11. company_hqs (line 292)
12. company_memberships (line 339)
13. consultant_deliverables (line 354)
14. contact_lists (line 381)
15. deliverable_templates (line 496)
16. domain_registry (line 511)
17. ecosystem_orgs (line 525)
18. email_activities (line 550)
19. email_sequences (line 579)
20. email_signatures (line 609)
21. event_metas (line 623)
22. event_plan_opps (line 648)
23. event_plans (line 661)
24. event_tuner_personas (line 679)
25. event_tuner_states (line 692)
26. event_tuners (line 704)
27. invite_tokens (line 725)
28. invoice_milestones (line 740)
29. invoice_template_milestones (line 757)
30. invoice_templates (line 771)
31. invoices (line 780)
32. landing_pages (line 807)
33. owners (line 825)
34. payments (line 858)
35. personas (line 878)
36. phase_deliverable_templates (line 911)
37. phase_templates (line 924)
38. pipelines (line 938)
39. platform (line 948)
40. presentations (line 957)
41. product_fits (line 981)
42. proposal_deliverables (line 1016)
43. proposal_phases (line 1032)
44. proposals (line 1048)
45. prospect_candidates (line 1073)
46. saved_events (line 1087)
47. sequence_steps (line 1110)
48. super_admins (line 1139)
49. template_relationship_helpers (line 1151)
50. work_collateral (line 1183)
51. work_package_items (line 1204)
52. work_package_phases (line 1230)
53. work_packages (line 1253)

## Fix Strategy

Replace all instances of:
```prisma
id String @id
```

With:
```prisma
id String @id @default(cuid())
```

