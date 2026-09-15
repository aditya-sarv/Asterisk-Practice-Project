module.exports = async function getOne(req, res, next) {
  try {
    const item = await req.service.getOne(req);
    res.json(item);
  } catch (err) {
    next(err);
  }
};
