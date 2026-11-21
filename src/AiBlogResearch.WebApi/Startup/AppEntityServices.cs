// Startup composition: entity repositories, tenancy, rights and the blog and collaboration features (moved out of Program.cs, no behaviour change).
using Adventures.Common.Diagnostics;
using Adventures.Data;
using Adventures.Data.Postgres;
using Adventures.Identity.Postgres;
using Adventures.Data.NQuad;
using Adventures.Entities;
using Adventures.Identity;
using Adventures.Ioc.Extensions;
using Adventures.Security;
using Adventures.WebApi;
using AiBlogResearch.WebApi;
using Microsoft.AspNetCore.Diagnostics;
using Serilog;
using Adventures.Blog;
using Adventures.Blog.Legacy;
using Adventures.Blog.WebApi;
using Adventures.Collaboration.WebApi;
using Adventures.Diagnostics.WebApi;
using Adventures.Identity.WebApi;
using Adventures.Blog.Postgres;
using Adventures.Collaboration;
using Adventures.MEF;

namespace AiBlogResearch.WebApi;

internal static class AppEntityServices
{
    public static IServiceCollection AddAppEntities(this IServiceCollection services, IReadOnlyList<NQuad> userQuads, IConfiguration configuration, bool isDevelopment)
    {
        var userSchema = SchemaDal.Load(userQuads, UserConstants.SchemaIri);

        services.AddNQuadEntityRepository(
            userSchema,
            UserConstants.BaseIri,
            UserConstants.TypeIri,
            UserConstants.DefaultGraph,
            schema => new User(schema));

        // SchemaBll (Adventures.Entities) is auto-registered by AddLifetimeServices above via its
        // reflection scan across every loaded assembly, not just what this host actually uses - ASP.NET
        // Core validates every registered service graph is resolvable at Build() time (Development
        // default), so SchemaEntity/SchemaFieldEntity repositories are needed here even though nothing
        // in this app calls ISchemaBll yet. Reuses the same seeded store; each schema is loaded the
        // same way the User schema above is - via SchemaDal.Load - no hardcoded MetaSchema anymore.
        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, ExceptionLogConstants.SchemaIri),
            ExceptionLogConstants.BaseIri,
            ExceptionLogConstants.TypeIri,
            ExceptionLogConstants.DefaultGraph,
            schema => new ExceptionLogEntry(schema));

        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, ExceptionSignatureConstants.SchemaIri),
            ExceptionSignatureConstants.BaseIri,
            ExceptionSignatureConstants.TypeIri,
            ExceptionSignatureConstants.DefaultGraph,
            schema => new ExceptionSignatureEntry(schema));

        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, EntityConstants.Schema.EntityTypeIri),
            EntityConstants.Schema.EntityBaseIri,
            EntityConstants.Schema.EntityTypeIri,
            UserConstants.DefaultGraph,
            schema => new SchemaEntity(schema));
        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, EntityConstants.Schema.FieldEntityTypeIri),
            EntityConstants.Schema.FieldEntityBaseIri,
            EntityConstants.Schema.FieldEntityTypeIri,
            UserConstants.DefaultGraph,
            schema => new SchemaFieldEntity(schema));

        // Identity schemas (seed 004): the data is untouched; each schema maps onto the existing predicates. Roles get an admin grid;
        // the rest are read through the relation provider (a user role assignments) and need only their registrations.
        static void AddIdentityEntity<TEntity>(
            IServiceCollection services, IReadOnlyList<NQuad> quads, string schemaIri, string baseIri, string typeIri, Func<EntitySchema, TEntity> factory)
            where TEntity : DynamicEntity =>
            services.AddNQuadEntityRepository(SchemaDal.Load(quads, schemaIri), baseIri, typeIri, IdentityConstants.DefaultGraph, factory);

        AddIdentityEntity(services, userQuads, IdentityConstants.RoleSchemaIri, IdentityConstants.RoleBaseIri, IdentityConstants.RoleTypeIri, s => new Role(s));
        AddIdentityEntity(services, userQuads, IdentityConstants.TenantSchemaIri, IdentityConstants.TenantBaseIri, IdentityConstants.TenantTypeIri, s => new Tenant(s));
        AddIdentityEntity(services, userQuads, IdentityConstants.BlogSchemaIri, IdentityConstants.BlogBaseIri, IdentityConstants.BlogTypeIri, s => new Blog(s));
        AddIdentityEntity(services, userQuads, IdentityConstants.OrganizationSchemaIri, IdentityConstants.OrganizationBaseIri, IdentityConstants.OrganizationTypeIri, s => new Organization(s));
        AddIdentityEntity(services, userQuads, IdentityConstants.TenantRoleSchemaIri, IdentityConstants.TenantRoleBaseIri, IdentityConstants.TenantRoleTypeIri, s => new TenantRoleAssignment(s));
        AddIdentityEntity(services, userQuads, IdentityConstants.OrganizationRoleSchemaIri, IdentityConstants.OrganizationRoleBaseIri, IdentityConstants.OrganizationRoleTypeIri, s => new OrganizationRoleAssignment(s));
        static void AddContentEntity<TEntity>(
            IServiceCollection services, IReadOnlyList<NQuad> quads, string schemaIri, string baseIri, string typeIri, Func<EntitySchema, TEntity> factory)
            where TEntity : DynamicEntity =>
            services.AddNQuadEntityRepository(SchemaDal.Load(quads, schemaIri), baseIri, typeIri, BlogConstants.Content.DefaultGraph, factory, tenantScoped: true);

        AddContentEntity(services, userQuads, BlogConstants.Content.PageSchemaIri, BlogConstants.Content.PageBaseIri, BlogConstants.Content.PageTypeIri, s => new Page(s));
        AddContentEntity(services, userQuads, BlogConstants.Content.PostSchemaIri, BlogConstants.Content.PostBaseIri, BlogConstants.Content.PostTypeIri, s => new Post(s));
        AddContentEntity(services, userQuads, BlogConstants.Content.CategorySchemaIri, BlogConstants.Content.CategoryBaseIri, BlogConstants.Content.CategoryTypeIri, s => new Category(s));
        AddContentEntity(services, userQuads, BlogConstants.Content.TagSchemaIri, BlogConstants.Content.TagBaseIri, BlogConstants.Content.TagTypeIri, s => new Tag(s));
        AddContentEntity(services, userQuads, BlogConstants.Content.VisitorCommentSchemaIri, BlogConstants.Content.VisitorCommentBaseIri, BlogConstants.Content.VisitorCommentTypeIri, s => new VisitorComment(s));
        AddContentEntity(services, userQuads, CollaborationConstants.CommentSchemaIri, CollaborationConstants.CommentBaseIri, CollaborationConstants.CommentTypeIri, s => new Comment(s));
        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, CollaborationConstants.SchemaIri), CollaborationConstants.BaseIri, CollaborationConstants.TypeIri,
            CollaborationConstants.DefaultGraph, s => new CollaborationItem(s), tenantScoped: true);
        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, PluginConstants.SchemaIri), PluginConstants.BaseIri, PluginConstants.TypeIri,
            CollaborationConstants.DefaultGraph, s => new Plugin(s), tenantScoped: true);
        // The platform administrator is a switch on the person (not a role, not tied to a tenant); only an existing platform administrator changes it.
        services.AddNQuadPlatformAdministrators();
        services.AddScoped<ITenantAliasEditor, TenantAliasEditor>();
        // The tenant switcher: a person acts in the tenants they belong to (a platform administrator in every one); the X-Acting-Tenant header is checked on every request.
        services.AddScoped<IActingTenants, ActingTenants>();
        services.AddScoped<IRightsResolver, RightsResolver>();
        services.AddScoped<IRoleRightsEditor, RoleRightsEditor>();
        services.AddRightsAuthorization();
        services.AddScoped<IEntityBll<Tenant>>(provider => new EntityBll<Tenant>(provider.GetRequiredService<IEntityDal<Tenant>>()));
        services.AddScoped<IEntityBll<Organization>>(provider => new EntityBll<Organization>(provider.GetRequiredService<IEntityDal<Organization>>()));
        services.AddScoped<ITenantResolver, TenantResolver>();
        // T1: the tenant of each request is decided from the host the server saw (Tenancy:Enforcement = Off, Report (default) or Enforce; Tenancy:FallbackDomain only in Development).
        services.AddTenancy(configuration, isDevelopment);
        // T2: posts, pages, categories, tags, comments, collaboration items and site settings live in the request tenant's own graph; every tenant is equal and a host with no tenant sees none of it.
        services.AddScoped<IGraphScope, RequestGraphScope>();
        // T3b: the people screen shows and changes only members of the request tenant; sign-in and the profile keep the plain, global IUserBll.
        services.AddScoped<ITenantContext, RequestGraphScope>();
        services.AddNQuadUserMembership();
        services.AddScoped<UserVisibility>();
        services.AddScoped<PlatformUserVisibilityFilter>();
        services.AddScoped<TenantScopedUserBll>();
        services.AddScoped<ITenantUserPresenter, TenantUserPresenter>();
        services.AddNQuadEntityRepository(
            SchemaDal.Load(userQuads, BlogConstants.Site.SettingSchemaIri), BlogConstants.Site.SettingBaseIri, BlogConstants.Site.SettingTypeIri,
            BlogConstants.Site.DefaultGraph, s => new SiteSetting(s), tenantScoped: true);
        services.AddBlog();
        services.AddCollaboration();
        services.AddNQuadRelations();
        services.AddNQuadRelationWriter();
        services.AddIdentityRelationGuards();
        services.AddScoped<IEntityBll<Role>>(provider => new EntityBll<Role>(provider.GetRequiredService<IEntityDal<Role>>()));
        services.AddScoped<IEntityPresenter<Role>>(provider => new RolePresenter(
            provider.GetRequiredService<IEntityBll<Role>>(), provider.GetRequiredService<EntitySchemaOf<Role>>(), provider.GetService<IEntityRelationProvider>()));
        return services;
    }
}
