using System.Security.Cryptography;
using System.Text;

namespace LegacyImport;

/// <summary>
/// Stable ids for imported entities. A legacy row that has its own GUID keeps it; every other row, and every live term that has no
/// legacy id (a tag, a category name), gets a version 5 (name based) UUID, so running the import twice addresses the same entities.
/// </summary>
public static class LegacyIds
{
    /// <summary>Namespace for every id this tool derives (a fixed random GUID, never changed).</summary>
    private static readonly Guid Namespace = new("6f1c2b8e-3d54-4a0b-9a77-5e0a1c4d8b92");

    public static Guid Derive(string name) => Version5(Namespace, name);

    /// <summary>RFC 4122 version 5 (SHA-1, name based) UUID, public so a test can check it against the RFC example.</summary>
    public static Guid Version5(Guid namespaceId, string name)
    {
        var namespaceBytes = namespaceId.ToByteArray();
        SwapByteOrder(namespaceBytes);
        var nameBytes = Encoding.UTF8.GetBytes(name);
        var input = new byte[namespaceBytes.Length + nameBytes.Length];
        namespaceBytes.CopyTo(input, 0);
        nameBytes.CopyTo(input, namespaceBytes.Length);

        var hash = SHA1.HashData(input);
        var bytes = new byte[16];
        Array.Copy(hash, bytes, 16);
        bytes[6] = (byte)((bytes[6] & 0x0F) | 0x50); // version 5
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80); // RFC 4122 variant
        SwapByteOrder(bytes);
        return new Guid(bytes);
    }

    /// <summary>The id a mirror row gets: its own GUID column when the table has one, else a derived id from the table and the identity column.</summary>
    public static Guid ForRow(string table, IReadOnlyDictionary<string, object?> row, string identityColumn)
    {
        var own = table switch
        {
            "be_Posts" => "PostID",
            "be_Pages" => "PageID",
            "be_Categories" => "CategoryID",
            "be_Blogs" => "BlogId",
            _ => null,
        };

        if (own is not null && row.TryGetValue(own, out var value) && value is Guid guid)
        {
            return guid;
        }

        return Derive($"{table}:{row[identityColumn]}");
    }

    public static Guid ForCategoryName(string name) => Derive("live-category:" + name.Trim().ToLowerInvariant());

    public static Guid ForTagName(string name) => Derive("live-tag:" + name.Trim().ToLowerInvariant());

    // Guid.ToByteArray is little endian for the first three fields; RFC 4122 hashing wants network order
    private static void SwapByteOrder(byte[] guid)
    {
        (guid[0], guid[3]) = (guid[3], guid[0]);
        (guid[1], guid[2]) = (guid[2], guid[1]);
        (guid[4], guid[5]) = (guid[5], guid[4]);
        (guid[6], guid[7]) = (guid[7], guid[6]);
    }
}
