using AiBlogResearch.Security;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public class AuthControllerTests
{
    private static IConfiguration BuildConfiguration(string? userName = "demo", string? password = "ChangeMe123!") =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DemoUser:UserName"] = userName,
                ["DemoUser:Password"] = password,
            })
            .Build();

    private static IJwtTokenService BuildTokenService() =>
        new JwtTokenService(Options.Create(new JwtTokenOptions
        {
            Issuer = "TestIssuer",
            Audience = "TestAudience",
            SigningKey = "0123456789abcdef0123456789abcdef",
            AccessTokenLifetime = TimeSpan.FromMinutes(30),
        }));

    [Fact]
    public void Token_ReturnsOkWithAccessToken_WhenCredentialsAreValid()
    {
        var controller = new AuthController(BuildTokenService(), BuildConfiguration());

        var result = controller.Token(new TokenRequest("demo", "ChangeMe123!"));

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var tokenResponse = Assert.IsType<TokenResponse>(okResult.Value);
        Assert.False(string.IsNullOrWhiteSpace(tokenResponse.AccessToken));
        Assert.True(tokenResponse.ExpiresAtUtc > DateTimeOffset.UtcNow);
    }

    [Theory]
    [InlineData("demo", "WrongPassword")]
    [InlineData("wrong-user", "ChangeMe123!")]
    [InlineData("", "")]
    public void Token_ReturnsUnauthorized_WhenCredentialsAreInvalid(string userName, string password)
    {
        var controller = new AuthController(BuildTokenService(), BuildConfiguration());

        var result = controller.Token(new TokenRequest(userName, password));

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public void Token_ReturnsUnauthorized_WhenDemoUserIsNotConfigured()
    {
        var controller = new AuthController(BuildTokenService(), BuildConfiguration(userName: null, password: null));

        var result = controller.Token(new TokenRequest("demo", "ChangeMe123!"));

        Assert.IsType<UnauthorizedResult>(result.Result);
    }

    [Fact]
    public void WhoAmI_ReturnsUnknown_WhenNoAuthenticatedUserIsSet()
    {
        var controller = new AuthController(BuildTokenService(), BuildConfiguration());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext(),
        };

        var result = controller.WhoAmI();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("unknown", okResult.Value);
    }
}
