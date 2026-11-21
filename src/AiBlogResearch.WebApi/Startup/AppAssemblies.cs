using System.Reflection;

namespace AiBlogResearch.WebApi;

/// <summary>
/// Makes the assembly scan of <c>AddLifetimeServices()</c> independent of how the startup code is arranged. That scan only sees assemblies that are
/// already loaded, and .NET loads one the first time code that uses it is compiled. While every registration sat in one long method the host's
/// libraries were all loaded before the scan by accident; split into modules they are not, and the Bll, Dal and presenter classes of a library the
/// scan has not seen (the exception log, for one) are silently never registered. Loading every referenced library first removes the accident.
/// </summary>
internal static class AppAssemblies
{
    /// <summary>The host's own libraries (this application and the <c>Adventures.*</c> libraries it references) that plug-in discovery searches for exported plug-ins. Call after <see cref="EnsureReferencedLoaded"/>.</summary>
    public static IReadOnlyList<Assembly> HostAssemblies() =>
        AppDomain.CurrentDomain.GetAssemblies()
            // only the default load context: a plug-in DLL loaded from the plug-in directory lives in its own context and must not be mistaken for a host library
            .Where(a => !a.IsDynamic && System.Runtime.Loader.AssemblyLoadContext.GetLoadContext(a) == System.Runtime.Loader.AssemblyLoadContext.Default && a.GetName().Name is { } name && (name.StartsWith("Adventures.", StringComparison.Ordinal) || name.StartsWith("AiBlogResearch", StringComparison.Ordinal)))
            .ToList();

    /// <summary>Loads each assembly this application references (the .NET platform's own are skipped) and returns how many it loaded or found loaded.</summary>
    public static int EnsureReferencedLoaded()
    {
        var loaded = 0;
        foreach (var name in typeof(AppAssemblies).Assembly.GetReferencedAssemblies())
        {
            if (name.Name is null || name.Name.StartsWith("System", StringComparison.Ordinal) || name.Name.StartsWith("Microsoft", StringComparison.Ordinal)
                || name.Name is "netstandard" or "mscorlib" or "WindowsBase")
            {
                continue;
            }

            Assembly.Load(name);
            loaded++;
        }

        return loaded;
    }
}
