using Adventures.Data.NQuad;
using Adventures.Entities;

namespace NQuadBrowser.WebApi;

/// <summary>One kind of entity the browser can list and edit: a short key for the URL and the registration that says where it is stored.</summary>
public sealed record BrowserType(string Key, string Title, EntityTypeRegistration Registration);

/// <summary>
/// The entity kinds the browser offers, built from the schemas present in the store (a kind whose schema is not in the store is left out). Only
/// the generic model is named here: schemas and their fields, users and their roles and tenants, and the exception log. A feature's own types
/// (posts, collaboration items) are not known to the browser, which is the point of keeping it independent of them.
/// </summary>
public static class BrowserCatalog
{
    public static IReadOnlyList<BrowserType> Build(IReadOnlyList<NQuad> quads)
    {
        var graph = EntityConstants.Identity.DefaultGraph;
        var candidates = new (string Key, string Title, string SchemaIri, string BaseIri, string TypeIri, string Graph)[]
        {
            ("schemas", "Schemas", EntityConstants.Schema.EntityTypeIri, EntityConstants.Schema.EntityBaseIri, EntityConstants.Schema.EntityTypeIri, EntityConstants.User.DefaultGraph),
            ("schema-fields", "Schema fields", EntityConstants.Schema.FieldEntityTypeIri, EntityConstants.Schema.FieldEntityBaseIri, EntityConstants.Schema.FieldEntityTypeIri, EntityConstants.User.DefaultGraph),
            ("users", "Users", EntityConstants.Schema.UserIri, EntityConstants.User.BaseIri, EntityConstants.User.TypeIri, EntityConstants.User.DefaultGraph),
            ("roles", "Roles", EntityConstants.Identity.RoleSchemaIri, EntityConstants.Identity.RoleBaseIri, EntityConstants.Identity.RoleTypeIri, graph),
            ("tenants", "Tenants", EntityConstants.Identity.TenantSchemaIri, EntityConstants.Identity.TenantBaseIri, EntityConstants.Identity.TenantTypeIri, graph),
            ("blogs", "Blogs (tenant sites)", EntityConstants.Identity.BlogSchemaIri, EntityConstants.Identity.BlogBaseIri, EntityConstants.Identity.BlogTypeIri, graph),
            ("organizations", "Organizations", EntityConstants.Identity.OrganizationSchemaIri, EntityConstants.Identity.OrganizationBaseIri, EntityConstants.Identity.OrganizationTypeIri, graph),
            ("tenant-roles", "Tenant role assignments", EntityConstants.Identity.TenantRoleSchemaIri, EntityConstants.Identity.TenantRoleBaseIri, EntityConstants.Identity.TenantRoleTypeIri, graph),
            ("organization-roles", "Organization role assignments", EntityConstants.Identity.OrganizationRoleSchemaIri, EntityConstants.Identity.OrganizationRoleBaseIri, EntityConstants.Identity.OrganizationRoleTypeIri, graph),
            ("exceptions", "Exception log", EntityConstants.ExceptionLog.SchemaIri, EntityConstants.ExceptionLog.BaseIri, EntityConstants.ExceptionLog.TypeIri, EntityConstants.ExceptionLog.DefaultGraph),
            ("exception-signatures", "Exception signatures", EntityConstants.ExceptionSignatureEntity.SchemaIri, EntityConstants.ExceptionSignatureEntity.BaseIri, EntityConstants.ExceptionSignatureEntity.TypeIri, EntityConstants.ExceptionSignatureEntity.DefaultGraph),
        };

        var types = new List<BrowserType>();
        foreach (var candidate in candidates)
        {
            if (!quads.Any(q => string.Equals(q.Subject, candidate.SchemaIri, StringComparison.Ordinal)))
            {
                continue;
            }

            var schema = SchemaDal.Load(quads, candidate.SchemaIri);
            types.Add(new BrowserType(candidate.Key, candidate.Title, new EntityTypeRegistration(schema, candidate.BaseIri, candidate.TypeIri, candidate.Graph)));
        }

        return types;
    }
}
