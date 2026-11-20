using Adventures.Identity;
using Xunit;

namespace AiBlogResearch.WebApi.Tests;

/// <summary>Legacy mode has no identity store: creating a sign-in is refused with the explanatory message (the controller turns it into a 501, tested in Adventures.Identity.WebApi.Tests).</summary>
public class LegacyUserProvisioningTests
{
    [Fact]
    public async Task SetInitialPassword_IsRefusedWithTheExplanation()
    {
        var ex = await Assert.ThrowsAsync<NotSupportedException>(() =>
            new LegacyUserProvisioning().SetInitialPasswordAsync("t1", "bill", null, null));

        Assert.Equal(LegacyUserProvisioning.Message, ex.Message);
    }
}
