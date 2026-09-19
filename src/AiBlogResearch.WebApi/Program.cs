using AiBlogResearch.Security;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Add services to the container.

const string AngularCorsPolicy = "Angular";

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy(AngularCorsPolicy, policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddSharedJwtAuthentication(builder.Configuration);

builder.Services.AddOptions<M2MClientsOptions>()
    .Bind(builder.Configuration.GetSection(M2MClientsOptions.SectionName));
builder.Services.AddSingleton<IClientSecretHasher, ClientSecretHasher>();
builder.Services.AddSingleton<IClientCredentialStore, InMemoryClientCredentialStore>();
builder.Services.AddScopeAuthorization("mcp.postgres.query", "mcp.filesearch.search");

var app = builder.Build();

// Configure the HTTP request pipeline.
// UseCors must come before any Map* calls so it runs ahead of terminal
// middleware (health checks, controllers) and can attach CORS headers.
app.UseHttpsRedirection();
app.UseCors(AngularCorsPolicy);

app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
