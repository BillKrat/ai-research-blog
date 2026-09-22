using Adventures.Identity;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public class AuthControllerTests
{
    private static IConfiguration BuildConfiguration(string? tenant = "global-webnet.com") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:Tenant"] = tenant,
            })
            .Build();

    [Fact]
    public async Task Token_ReturnsOkWithAccessToken_WhenCredentialsAreValid()
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(30);
        var accountService = new FakeUserAccountService(LoginResult.Success("fake-token", expiresAt, mustChangePassword: true));
        var controller = new AuthController(accountService, BuildConfiguration());

        var result = await controller.Token(new TokenRequest("Admin", "Password"));

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var tokenResponse = Assert.IsType<TokenResponse>(okResult.Value);
        Assert.Equal("fake-token", tokenResponse.AccessToken);
        Assert.Equal(expiresAt, tokenResponse.ExpiresAtUtc);
        Assert.True(tokenResponse.MustChangePassword);
        Assert.Equal("global-webnet.com", accountService.LastTenant);
        Assert.Equal("Admin", accountService.LastUsername);
        Assert.Equal("Password", accountService.LastPassword);
    }

    [Theory]
    [InlineData("wrong-user", "Password")]
    [InlineData("Admin", "WrongPassword")]
    [InlineData("", "")]
    public async Task Token_ReturnsUnauthorized_WhenCredentialsAreInvalid(string userName, string password)
    {
        var accountService = new FakeUserAccountService(LoginResult.Failure(LoginFailureReason.InvalidCredentials));
        var controller = new AuthController(accountService, BuildConfiguration());

        var result = await controller.Token(new TokenRequest(userName, password));

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public async Task Token_UsesConfiguredTenant_DefaultingToGlobalWebnetWhenUnset()
    {
        var accountService = new FakeUserAccountService(LoginResult.Failure(LoginFailureReason.InvalidCredentials));
        var controller = new AuthController(accountService, BuildConfiguration(tenant: null));

        await controller.Token(new TokenRequest("Admin", "Password"));

        Assert.Equal("global-webnet.com", accountService.LastTenant);
    }

    [Fact]
    public void WhoAmI_ReturnsUnknown_WhenNoAuthenticatedUserIsSet()
    {
        var accountService = new FakeUserAccountService(LoginResult.Failure(LoginFailureReason.InvalidCredentials));
        var controller = new AuthController(accountService, BuildConfiguration());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext(),
        };

        var result = controller.WhoAmI();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("unknown", okResult.Value);
    }

    private sealed class FakeUserAccountService(LoginResult result) : IUserAccountService
    {
        public string? LastTenant { get; private set; }

        public string? LastUsername { get; private set; }

        public string? LastPassword { get; private set; }

        public Task<LoginResult> LoginAsync(string tenant, string username, string password, CancellationToken cancellationToken = default)
        {
            LastTenant = tenant;
            LastUsername = username;
            LastPassword = password;
            return Task.FromResult(result);
        }
    }
}
