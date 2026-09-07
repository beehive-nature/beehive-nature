/* Report-format-independent gates. A missing observation is never a green floor. */
export function validatePageSet(value) {
  if(!Array.isArray(value) || !value.length || value.some(p=>typeof p!=='string' || !p.trim()))
    throw new Error('Coverage page set must be a non-empty array of paths');
  if(new Set(value).size!==value.length) throw new Error('Coverage page set contains duplicate paths');
  if(value.some(p=>p!==p.trim() || /[%?#:\\]/.test(p) || !p.endsWith('.html') ||
    p.split('/').some(part=>!part || part==='.' || part==='..')))
    throw new Error('Coverage paths must be canonical surface-relative HTML paths');
  return value;
}

export function inspectCoverage(rows, floors={}, enforceFloors=false) {
  const errors=[], breaches=[];
  if(!rows.length) errors.push('No pages were measured');
  if(enforceFloors) {
    if(!floors || Array.isArray(floors) || typeof floors!=='object')
      return {passed:false,errors:['Coverage floors must be an object'],breaches};
    for(const [page,value] of Object.entries(floors))
      if(!Number.isInteger(value) || value<0) errors.push('Invalid keyed floor: '+page);
  }
  for(const row of rows) {
    if(row.error){errors.push(row.page+': '+row.error);continue;}
    if(!Number.isInteger(row.visible) || !Number.isInteger(row.keyed) || row.keyed<0 || row.visible<row.keyed){
      errors.push(row.page+': invalid measurement');continue;
    }
    if(enforceFloors && Object.prototype.hasOwnProperty.call(floors,row.page) && row.keyed<floors[row.page])
      breaches.push({page:row.page,keyed:row.keyed,floor:floors[row.page]});
  }
  return {passed:!errors.length && !breaches.length,errors,breaches};
}
