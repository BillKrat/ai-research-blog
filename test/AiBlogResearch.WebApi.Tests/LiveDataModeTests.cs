using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

public class LiveDataModeTests
{
    private static ConfigurationManager Config(params (string Key, string Value)[] values)
    {
        var config = new ConfigurationManager();
        config.AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value));
        return config;
    }

    [Fact]
    public void Is_off_by_default_and_changes_nothing()
    {
        var config = Config(("ConnectionStrings:Postgres", "local"));

        Assert.False(LiveDataMode.Apply(config, isDevelopment: true));
        Assert.Equal("local", config["ConnectionStrings:Postgres"]);
    }

    [Fact]
    public void When_enabled_in_development_points_the_app_at_the_live_connection()
    {
        var config = Config(("LiveData:Enabled", "true"), ("LiveData:ConnectionString", "live"), ("ConnectionStrings:Postgres", "local"));

        Assert.True(LiveDataMode.Apply(config, isDevelopment: true));
        Assert.Equal("live", config["ConnectionStrings:Postgres"]);
    }

    [Fact]
    public void Refuses_to_run_outside_development()
    {
        var config = Config(("LiveData:Enabled", "true"), ("LiveData:ConnectionString", "live"));

        var error = Assert.Throws<InvalidOperationException>(() => LiveDataMode.Apply(config, isDevelopment: false));
        Assert.Contains("Development", error.Message);
    }

    [Fact]
    public void Refuses_without_a_live_connection_string()
    {
        var config = Config(("LiveData:Enabled", "true"), ("ConnectionStrings:Postgres", "local"));

        var error = Assert.Throws<InvalidOperationException>(() => LiveDataMode.Apply(config, isDevelopment: true));
        Assert.Contains("LiveData:ConnectionString", error.Message);
        Assert.Equal("local", config["ConnectionStrings:Postgres"]);
    }
}
