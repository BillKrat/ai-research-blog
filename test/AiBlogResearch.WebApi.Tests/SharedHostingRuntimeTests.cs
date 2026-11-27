using System.Text.Json;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>
/// The host runs in a small shared application pool, where the server garbage collector (the web SDK's default) holds more memory than
/// the workstation one. The setting had been switched off by hand on the servers (found 2026-11-27); the build carries it now, so an
/// upload no longer reverts it. Read from the runtime configuration the build wrote, which is the file the host starts with.
/// </summary>
public sealed class SharedHostingRuntimeTests
{
    [Fact]
    public void The_host_is_built_without_the_server_garbage_collector()
    {
        var file = Path.Combine(AppContext.BaseDirectory, "AiBlogResearch.WebApi.runtimeconfig.json");
        using var document = JsonDocument.Parse(File.ReadAllText(file));

        var properties = document.RootElement.GetProperty("runtimeOptions").GetProperty("configProperties");
        Assert.False(properties.GetProperty("System.GC.Server").GetBoolean());
    }
}
