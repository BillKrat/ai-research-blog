using Adventures.Blog.WebApi;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>The blog controllers live in Adventures.Blog.WebApi (S3); the host must make MVC find them exactly once.</summary>
public class BlogControllersDiscoveryTests
{
    [Fact]
    public void AddBlogControllers_exposes_each_blog_controller_once_next_to_the_apps_own()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddControllers().AddApplicationPart(typeof(AiBlogResearch.WebApi.Controllers.TenantController).Assembly).AddBlogControllers();

        using var provider = services.BuildServiceProvider();
        var manager = provider.GetRequiredService<ApplicationPartManager>();
        var feature = new ControllerFeature();
        manager.PopulateFeature(feature);

        var names = feature.Controllers.Select(t => t.FullName).ToList();
        Assert.Single(names, n => n == typeof(AuthoringController).FullName);
        Assert.Single(names, n => n == typeof(PostsController).FullName);
        Assert.Single(names, n => n == typeof(PublicController).FullName);
        Assert.Contains(typeof(AiBlogResearch.WebApi.Controllers.TenantController).FullName, names);
    }
}
