namespace LegacyImport;

/// <summary>One legacy role assignment of a person, after the role names are mapped onto the live roles.</summary>
public sealed record PlannedAssignment(string UserName, string LegacyRole, string LiveRole, bool AlreadyAssigned);

/// <summary>
/// What stage C would do and what it found. Nothing here writes: the plan is data for the report and for the human's decisions.
/// </summary>
/// <param name="RoleMap">Legacy role name to the live role it maps onto (null: the legacy role has no live counterpart and is dropped).</param>
/// <param name="Assignments">For a legacy person who matches a live account by user name: each mapped role with whether the account already holds it.</param>
/// <param name="CandidateAccounts">Legacy people with no live account: not created (no password hash comes across, and the human decides who stays).</param>
/// <param name="UnmappedRoles">Legacy roles dropped because the new app has no counterpart.</param>
/// <param name="Rights">Legacy rights counts, for the record: the BlogEngine rights matrix is deliberately not ported.</param>
public sealed record IdentityPlan(
    IReadOnlyDictionary<string, string?> RoleMap,
    IReadOnlyList<PlannedAssignment> Assignments,
    IReadOnlyList<string> CandidateAccounts,
    IReadOnlyList<string> UnmappedRoles,
    int DistinctRights,
    int RightRoleRows);

/// <summary>
/// Stage C of the legacy migration (docs/Claude-decision-2026-10-legacy-table-migration-plan.md): roles, rights and assignments.
/// The decisions it encodes (from the migration map): the BlogEngine rights matrix is not ported; only people in use matter, so legacy
/// users become account CANDIDATES, never accounts (no password hash crosses over); assignments are planned only for a person who already
/// has a live account of the same user name; roles are matched by meaning, not created wholesale.
/// </summary>
public static class IdentityProjection
{
    /// <summary>Legacy role name to live role name. A null value drops the role (Anonymous is implicit in the new app; Viewers have no counterpart).</summary>
    public static readonly IReadOnlyDictionary<string, string?> DefaultRoleMap = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
    {
        ["Administrators"] = "Admin",
        ["Admin"] = "Admin",
        ["Editors"] = "Editor",
        ["Viewers"] = null,
        ["Viewer"] = null,
        ["Anonymous"] = null,
    };

    /// <param name="liveAssignments">Live account user name to the live role names it holds (case-insensitive on both).</param>
    public static IdentityPlan Plan(
        IReadOnlyDictionary<string, IReadOnlyList<LegacyRowData>> tables,
        IReadOnlyDictionary<string, IReadOnlySet<string>> liveAssignments,
        IReadOnlyDictionary<string, string?>? roleMap = null)
    {
        roleMap ??= DefaultRoleMap;
        string Text(LegacyRowData row, string column) => (row.GetValueOrDefault(column) as string)?.Trim() ?? string.Empty;
        var live = new Dictionary<string, IReadOnlySet<string>>(liveAssignments, StringComparer.OrdinalIgnoreCase);

        // every legacy role name in use (the role table and the assignments), mapped; an unknown name is dropped and reported, never guessed
        var legacyRoles = tables["be_Roles"].Select(r => Text(r, "Role"))
            .Concat(tables["be_UserRoles"].Select(r => Text(r, "Role")))
            .Where(name => name.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        var map = legacyRoles.ToDictionary(name => name, name => roleMap.TryGetValue(name, out var mapped) ? mapped : null, StringComparer.OrdinalIgnoreCase);
        var unmapped = map.Where(pair => pair.Value is null).Select(pair => pair.Key).ToList();

        // the legacy people: one per distinct user name (a name is repeated per blog), with the roles they hold across all blogs
        var rolesByPerson = tables["be_UserRoles"]
            .GroupBy(r => Text(r, "UserName"), StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Key.Length > 0)
            .ToDictionary(g => g.Key, g => g.Select(r => Text(r, "Role")).Where(n => n.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList(), StringComparer.OrdinalIgnoreCase);
        var people = tables["be_Users"].Select(r => Text(r, "UserName")).Where(n => n.Length > 0)
            .Concat(rolesByPerson.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var assignments = new List<PlannedAssignment>();
        var candidates = new List<string>();
        foreach (var person in people)
        {
            if (!live.TryGetValue(person, out var held))
            {
                candidates.Add(person);
                continue;
            }

            foreach (var role in rolesByPerson.GetValueOrDefault(person) ?? [])
            {
                if (map.TryGetValue(role, out var liveRole) && liveRole is not null)
                {
                    assignments.Add(new PlannedAssignment(person, role, liveRole, held.Contains(liveRole, StringComparer.OrdinalIgnoreCase)));
                }
            }
        }

        // one planned assignment per person and live role (a person is listed once per blog in the legacy tables)
        assignments = assignments.GroupBy(a => (a.UserName.ToLowerInvariant(), a.LiveRole.ToLowerInvariant())).Select(g => g.First()).ToList();
        var rights = tables.TryGetValue("be_Rights", out var rightRows) ? rightRows.Select(r => Text(r, "RightName")).Where(n => n.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).Count() : 0;
        var rightRoles = tables.TryGetValue("be_RightRoles", out var rightRoleRows) ? rightRoleRows.Count : 0;
        return new IdentityPlan(map, assignments, candidates, unmapped, rights, rightRoles);
    }

    /// <summary>The plan as lines for a report (no secrets, nothing about passwords).</summary>
    public static IEnumerable<string> Describe(IdentityPlan plan)
    {
        yield return "Role map (legacy -> live):";
        foreach (var (legacy, live) in plan.RoleMap)
        {
            yield return $"    {legacy,-16} -> {live ?? "(dropped: no counterpart in the new app)"}";
        }

        yield return $"Assignments for people who already have a live account ({plan.Assignments.Count}):";
        foreach (var a in plan.Assignments)
        {
            yield return $"    {a.UserName,-20} {a.LiveRole,-10} {(a.AlreadyAssigned ? "already assigned" : "MISSING: add it in Admin > Users")}  (legacy role {a.LegacyRole})";
        }

        yield return $"Legacy people with no live account, candidates only, none created ({plan.CandidateAccounts.Count}): {string.Join(", ", plan.CandidateAccounts)}";
        yield return $"Rights: {plan.DistinctRights} distinct rights over {plan.RightRoleRows} role-right rows stay in the mirror; the BlogEngine rights matrix is not ported.";
    }
}

/// <summary>Reads which live account holds which live roles, straight from the quads (the same links the admin's role assignment grid writes).</summary>
public static class LiveIdentity
{
    private const string AccountName = "http://xmlns.com/foaf/0.1/accountName";
    private const string HasTenantRole = "https://global-webnet.com/ontology/tenant#hasTenantRole";
    private const string AssignmentRole = "https://global-webnet.com/ontology/tenant#role";
    private const string RoleName = "https://global-webnet.com/ontology/tenant#name";

    public static IReadOnlyDictionary<string, IReadOnlySet<string>> Assignments(IEnumerable<Adventures.Data.NQuad.NQuad> quads)
    {
        var all = quads.ToList();
        static string Plain(string value) => value.Length >= 2 && value[0] == '"' ? value[1..value.LastIndexOf('"')] : value;
        var accountNames = all.Where(q => q.Predicate == AccountName).GroupBy(q => q.Subject).ToDictionary(g => g.Key, g => Plain(g.Last().Object));
        var roleNames = all.Where(q => q.Predicate == RoleName && q.Subject.Contains("/id/role/")).GroupBy(q => q.Subject).ToDictionary(g => g.Key, g => Plain(g.Last().Object));
        var assignmentRole = all.Where(q => q.Predicate == AssignmentRole).GroupBy(q => q.Subject).ToDictionary(g => g.Key, g => g.Last().Object);

        var result = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        foreach (var (subject, name) in accountNames)
        {
            var roles = result.TryGetValue(name, out var existing) ? existing : result[name] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var link in all.Where(q => q.Subject == subject && q.Predicate == HasTenantRole))
            {
                if (assignmentRole.TryGetValue(link.Object, out var roleId) && roleNames.TryGetValue(roleId, out var role))
                {
                    roles.Add(role);
                }
            }
        }

        return result.ToDictionary(p => p.Key, p => (IReadOnlySet<string>)p.Value, StringComparer.OrdinalIgnoreCase);
    }
}
