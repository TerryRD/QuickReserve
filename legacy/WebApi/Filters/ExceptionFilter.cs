// WebApi/Filters/ExceptionFilter.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Net;

namespace WebApi.Filters
{
    public class ExceptionFilter : IExceptionFilter
    {
        private readonly ILogger<ExceptionFilter> _logger;

        public ExceptionFilter(ILogger<ExceptionFilter> logger)
        {
            _logger = logger;
        }

        public void OnException(ExceptionContext context)
        {
            _logger.LogError(new EventId(context.Exception.HResult),
                             context.Exception,
                             context.Exception.Message);

            var problemDetails = new ProblemDetails
            {
                Status = (int)HttpStatusCode.InternalServerError,
                Title = "An error occurred while processing your request.",
                Detail = "Please try again later. If the problem persists, contact support."
            };

            // Optionally, add more details in development environment
            if (context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment())
            {
                problemDetails.Detail = context.Exception.ToString();
            }

            context.Result = new ObjectResult(problemDetails)
            {
                StatusCode = problemDetails.Status
            };

            context.ExceptionHandled = true;
        }
    }
}
