using Xunit;

// Each test boots the real host, and Program.cs sets up the process-wide Serilog logger; two hosts starting at the same moment race on it
// ("The logger is already frozen"). One test at a time keeps this project reliable.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
