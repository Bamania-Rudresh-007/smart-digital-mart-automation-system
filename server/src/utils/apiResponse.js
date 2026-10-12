class ApiResponse {
  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors
    });
  }

  static paginated(res, message, data, page = 1, limit = 50, total = 0, statusCode = 200) {
    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const parsedTotal = Number.parseInt(total, 10);

    const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const safeTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0;
    const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);

    return res.status(statusCode).json({
      success: true,
      message,
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: safeTotal,
        totalPages
      }
    });
  }
}

export default ApiResponse;
