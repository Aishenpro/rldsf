# Role and permission matrix

Roles are stored in `roles`; permissions are mapped through `role_permissions`. Enforcement uses backend middleware, not client-side hiding. Seeded mappings:

| Role | Permissions |
|---|---|
| Administrator | All seeded permissions, including site, finance, sensitive, content, and countdown |
| Maintainer | Content write/approval and countdown management |
| Content Editor | Content writing and programme management |
| Finance Manager | Finance management |
| Programme Manager | Programme management |
| Member | No staff permissions |

This mapping is a starting template requiring leadership review. Create no staff accounts based on a display name. Supplied labels AdminX, Jamirah, Mr. Roger and N.Grace are not credentials and are not seeded as users. Keep financial and sensitive-health permissions narrowly assigned. Countdown creation is separately permissioned. Permission changes should be reviewed and audited.
