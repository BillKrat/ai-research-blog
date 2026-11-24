# Stage review: profile fields (beta row 12, parity stage 5), 2026-11-22

BlogEngine's profile has About me, Website and a picture; ours had Display name, names, phone, DOB and e-mail. The profile page is built from the User schema, so adding the fields to the schema is all the screen needs.

```mermaid
flowchart LR
  S[seed 027: AboutMe, Website, Picture on the User schema] --> F[Profile page: schema-driven form shows them]
  F --> B[UserBll.Validate on every save]
  B --> R{Website: http or https only, no spaces or quotes, no sign-in part; Picture: http(s) or a path on this site; About me up to 1000}
  R -- ok --> ST[(stored on the user)]
  R -- not ok --> E[the field's own message, nothing saved]
```

## What was built
- **Seed 027 (`027-profile-fields`):** three optional String fields on the User schema: About me, Website, Picture address (applied once at start-up; existing users simply have them empty).
- **Rules in `UserBll`:** the website must be an http or https address (no spaces, quotes or angle brackets, no user:password part, at most 300 characters); the picture the same, or a path on this site such as `/media/me.png` (one slash, never `//`, which would mean another host); About me at most 1000 characters. `javascript:`, `data:`, `ftp:`, `mailto:` and bare words are refused with the field's own message. Nothing here is rendered on the public site yet; when an author box is added, the values must still be shown as text and the website as a link with `rel` set, which these rules already make safe to do.
- **Tests:** schema offers the fields, valid save, optional, 7 bad websites, 5 bad pictures, length limits. Foundation, API and host suites pass.

## Not done
- No picture upload or preview on the profile page (the picture is an address; the media upload already gives a `/media/...` path to paste). About me is a one-line text box (the schema has no multi-line type for users yet).
- Title, middle name, address, birthday, extra phones, company and the like stay out of beta (matrix: after beta).
- Not seen in a browser.

## Test steps
1. Profile: About me, Website and Picture address appear; fill them with valid values (`https://example.org`, `/media/<an uploaded image>`), Save, reload: kept.
2. Website `javascript:alert(1)`, `example.org`, or with a space: refused with a message on that field. Picture `data:...` or `//evil.example/x.png`: refused.
3. About me over 1000 characters: refused.
