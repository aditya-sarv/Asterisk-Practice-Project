module.exports = async function download(req, res, next) {
  try {
    if (typeof req.service.download !== 'function') {
      return res.status(404).json({ success: false, message: `"${req.route_info}" does not support download.` });
    }

    const result = await req.service.download(req);
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result);
    }

    res.download(result.filePath, result.fileName);
  } catch (err) {
    next(err);
  }
};
