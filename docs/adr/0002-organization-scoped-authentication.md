# Organization-scoped authentication

Authentication is scoped to an Organization before credentials are checked: users first resolve an Organization Login Code, then sign in on that Organization's Sign-In Page. We chose this over generic email/password login or a global identity system so the same email can exist as separate Organization Memberships, sessions remain Organization-scoped, and future subdomain/custom-domain tenants can use isolated auth cookies without changing the domain model.

Generic credential login is intentionally not part of the product model. Membership creation remains controlled by Organization admins or approved import/invite workflows, with Membership Activation and Membership Recovery scoped to exactly one Organization Membership.
