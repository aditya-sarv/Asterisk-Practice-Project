module.exports = async function update(req, res, next) {
  try {
    const updated = await req.service.update(req);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};
