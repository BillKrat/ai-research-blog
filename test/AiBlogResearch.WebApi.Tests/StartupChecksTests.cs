using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

public class StartupChecksTests
{
    private static IConfiguration Config(params (string Key, string Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value)).Build();

    [Fact]
    public void A_complete_configuration_has_no_problems()
    {
        Assert.Empty(StartupChecks.Find(Config(("ConnectionStrings:Postgres", "p"), ("Jwt:SigningKey", "k")), isDevelopment: false));
    }

    [Fact]
    public void Live_data_without_its_connection_string_names_that_key_not_postgres()
    {
        var problems = StartupChecks.Find(Config(("LiveData:Enabled", "true"), ("Jwt:SigningKey", "k")), isDevelopment: true);

        var problem = Assert.Single(problems);
        Assert.Equal("ConnectionStrings:LiveData", problem.Key);
    }

    [Fact]
    public void Live_data_outside_development_is_a_problem()
    {
        var problems = StartupChecks.Find(Config(("LiveData:Enabled", "true"), ("ConnectionStrings:LiveData", "x"), ("Jwt:SigningKey", "k")), isDevelopment: false);

        Assert.Contains(problems, p => p.Key == "LiveData:Enabled");
    }

    [Fact]
    public void A_missing_database_string_is_only_a_problem_outside_development_where_memory_is_the_offline_fallback()
    {
        var config = Config(("Jwt:SigningKey", "k"));

        Assert.Empty(StartupChecks.Find(config, isDevelopment: true));
        Assert.Contains(StartupChecks.Find(config, isDevelopment: false), p => p.Key == "ConnectionStrings:Postgres");
    }

    [Fact]
    public void A_missing_signing_key_is_always_a_problem_and_no_secret_value_is_in_the_message()
    {
        var problems = StartupChecks.Find(Config(("ConnectionStrings:Postgres", "Password=s3cret")), isDevelopment: true);

        Assert.Contains(problems, p => p.Key == "Jwt:SigningKey");
        Assert.DoesNotContain("s3cret", StartupChecks.ToException(problems).Message);
    }
}
