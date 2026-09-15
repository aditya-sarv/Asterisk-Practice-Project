module.exports = async function getAll(req, res, next) {
  try {
    const item = await req.service.getAll(req);
    res.json(item);
  } catch (err) {
    next(err);
  }
};
