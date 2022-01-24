/* eslint-disable unicorn/prevent-abbreviations */
'use-strict';

export const pages = (req, res) => {
  const maxPageSize = req.path === '/api/cameras' ? 50 : 6;
  const minPage = 1;

  let start = Number.parseInt(req.query.start); //for infinite scroll
  let page = Number.parseInt(req.query.page) || minPage;
  let pageSize = Number.parseInt(req.query.pageSize) || maxPageSize;

  // eslint-disable-next-line unicorn/prefer-number-properties
  start = !isNaN(start) ? start : null;
  const items = res.locals.items || [];
  const maxPage = Math.ceil(items.length / pageSize);

  pageSize = pageSize > maxPageSize ? maxPageSize : pageSize;
  page = page < minPage ? minPage : page;

  /*if(page > maxPage && items.length){
    throw new Error('Page not found');
  }*/

  const totalItems = items.length;
  const startIndex = start !== null ? start : (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize - 1, totalItems - 1);

  let pagination = {};

  pagination =
    start !== null
      ? {
          pageSize: pageSize,
          startIndex: startIndex,
          endIndex: endIndex,
          totalItems: totalItems,
        }
      : {
          currentPage: page,
          pageSize: pageSize,
          totalPages: maxPage,
          startIndex: startIndex,
          endIndex: endIndex,
          totalItems: totalItems,
          nextPage: page < items.length / pageSize ? `${req.path}?page=${page + 1}` : null,
          prevPage: page > 1 ? `${req.path}?page=${page - 1}` : null,
        };

  const result = items.slice(pagination.startIndex, pagination.endIndex + 1);

  res.status(200).send({ pagination, result });
};
