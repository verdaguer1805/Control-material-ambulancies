-- Cierra permisos heredados para llamadas anónimas o públicas.
begin;

revoke execute on function public.change_admin_pin(text,text,text) from public, anon;
revoke execute on function public.get_database_usage() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.initialize_olot_inventory(jsonb) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.prevent_duplicate_incident_per_unit() from public, anon;
revoke execute on function public.receive_central_stock(text,jsonb) from public, anon;
revoke execute on function public.set_inventory_quantity(text,text,integer) from public, anon;
revoke execute on function public.transfer_stock(text,text,jsonb) from public, anon;
revoke execute on function public.verify_admin_pin(text) from public, anon;
revoke execute on function public.verify_owner_code(text) from public, anon;

grant execute on function public.change_admin_pin(text,text,text) to authenticated;
grant execute on function public.get_database_usage() to authenticated;
grant execute on function public.initialize_olot_inventory(jsonb) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.receive_central_stock(text,jsonb) to authenticated;
grant execute on function public.set_inventory_quantity(text,text,integer) to authenticated;
grant execute on function public.transfer_stock(text,text,jsonb) to authenticated;
grant execute on function public.verify_admin_pin(text) to authenticated;
grant execute on function public.verify_owner_code(text) to authenticated;

commit;
