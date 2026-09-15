module.exports = async function remove(req, res, next) {
  try {
    const result = await req.service.remove(req);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
