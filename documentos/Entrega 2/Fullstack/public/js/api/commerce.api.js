import { request,visitorId } from './http.js';
export const get=(path,query)=>request('/commerce'+path,{query});
export const post=(path,body)=>request('/commerce'+path,{method:'POST',body});
export const patch=(path,body)=>request('/commerce'+path,{method:'PATCH',body});
export const remove=path=>request('/commerce'+path,{method:'DELETE'});
export const reserve=body=>post('/reservas',{...body,visitante:visitorId()});
export const pay=(reserva_id,metodo)=>post('/pagar',{reserva_id,metodo,visitante:visitorId()});
