using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public class RuntimeControllerTests
{
    private static RuntimeInfo Ask(params (string Key, string Value)[] settings) =>
        Assert.IsType<RuntimeInfo>(Assert.IsType<OkObjectResult>(
            new RuntimeController(new ConfigurationBuilder().AddInMemoryCollection(settings.ToDictionary(s => s.Key, s => (string?)s.Value)).Build()).Get().Result).Value);

    [Fact]
    public void ALocalRunOnTheLiveStoreSaysSo() => Assert.True(Ask(("LiveData:Active", "true")).LiveData);

    [Theory]
    [InlineData("false")]
    [InlineData("")]
    [InlineData("yes")]
    public void AnythingElseIsAnOrdinaryRun(string value) => Assert.False(Ask(("LiveData:Active", value)).LiveData);

    [Fact]
    public void NoSettingIsAnOrdinaryRun() => Assert.False(Ask().LiveData);

    [Fact]
    public void ItIsAnonymousAndHasNoDependencies()
    {
        Assert.NotEmpty(typeof(RuntimeController).GetCustomAttributes(typeof(Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute), inherit: true));
        Assert.Single(typeof(RuntimeController).GetConstructors().Single().GetParameters());
    }
}
