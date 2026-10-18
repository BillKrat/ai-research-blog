using System.Security.Claims;
using Adventures.Entities;
using AiBlogResearch.WebApi.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AiBlogResearch.WebApi.Tests.Controllers;

public sealed class ClientErrorsAndDiagnosticsTests
{
    private static ClientErrorsController NewController(UnhandledExceptionHandlerTests.RecordingExceptionLog log)
    {
        var controller = new ClientErrorsController(log, NullLogger<ClientErrorsController>.Instance);
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Name, "Admin")], "Bearer")),
        };
        context.Items[Adventures.WebApi.CorrelationIdMiddleware.ItemsKey] = "browser-1";
        controller.ControllerContext = new ControllerContext { HttpContext = context };
        return controller;
    }

    [Fact]
    public async Task Report_RecordsTheClientErrorThrottled_WithTheCorrelationId()
    {
        var log = new UnhandledExceptionHandlerTests.RecordingExceptionLog("e-1");

        var result = await NewController(log).Report(new ClientErrorReport("TypeError: x", "at f (a.js:1:1)", "/profile"), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        var recorded = Assert.Single(log.Throttled);
        Assert.IsType<ClientReportedException>(recorded.Exception);
        Assert.Equal("client: /profile", recorded.Request);
        Assert.Equal("browser-1", recorded.CorrelationId);
        Assert.Equal(ClientErrorsController.SameErrorWindow, recorded.Window);
    }

    [Fact]
    public async Task Report_RejectsAnEmptyMessage()
    {
        var log = new UnhandledExceptionHandlerTests.RecordingExceptionLog("e-1");

        var result = await NewController(log).Report(new ClientErrorReport("  ", null, null), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(log.Throttled);
    }

    [Fact]
    public void ClientErrors_RequiresSignIn_AndDiagnostics_RequiresAnAdministrator()
    {
        Assert.NotEmpty(typeof(ClientErrorsController).GetCustomAttributes(typeof(AuthorizeAttribute), true));
        var admin = Assert.Single(typeof(AdminDiagnosticsController).GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>());
        Assert.Equal(Adventures.Security.WellKnownClaims.TenantAdminPolicy, admin.Policy);
    }

    [Fact]
    public async Task LogSearch_FindsOnlyTheLinesOfOneRequest_AcrossFiles()
    {
        var directory = Directory.CreateTempSubdirectory().FullName;
        try
        {
            await File.WriteAllLinesAsync(Path.Combine(directory, "webapi-20261017.json.log"),
                ["""{"@m":"old a","CorrelationId":"req-1"}""", """{"@m":"other","CorrelationId":"req-2"}"""]);
            await File.WriteAllLinesAsync(Path.Combine(directory, "webapi-20261018.json.log"),
                ["""{"@m":"new a","CorrelationId":"req-1"}""", """{"@m":"none"}"""]);

            var lines = await LogSearch.FindLinesAsync(directory, "req-1");

            Assert.Equal(2, lines.Count);
            Assert.Contains("old a", lines[0]);
            Assert.Contains("new a", lines[1]);
            Assert.Empty(await LogSearch.FindLinesAsync(directory, "bad id!"));
            Assert.Empty(await LogSearch.FindLinesAsync(Path.Combine(directory, "missing"), "req-1"));
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }
}
