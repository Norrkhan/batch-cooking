-- Estado compartido de la compra (marcas y precios anotados en tienda).
-- Se ejecuta una vez en Supabase: SQL Editor → New query → pegar → Run.
-- Antes de ejecutarlo, cambia CAMBIA_ESTE_PIN (al final) por vuestro PIN (6 caracteres o más).
-- Se puede volver a ejecutar sin perder datos: también sirve para cambiar el PIN.

create extension if not exists pgcrypto with schema extensions;

-- Una fila por mes y artículo de la compra (item_id = id generado por scripts/generar_web.py)
create table if not exists public.compra_estado (
  mes            text not null check (mes ~ '^\d{4}-\d{2}$'),
  item_id        text not null check (length(item_id) <= 200),
  comprado       boolean not null default false,
  lidl_precio    numeric(8, 2) check (lidl_precio >= 0),
  lidl_formato   text check (length(lidl_formato) <= 40),
  costco_precio  numeric(8, 2) check (costco_precio >= 0),
  costco_formato text check (length(costco_formato) <= 40),
  actualizado    timestamptz not null default now(),
  primary key (mes, item_id)
);

-- Lectura pública; la escritura solo pasa por las funciones con PIN
alter table public.compra_estado enable row level security;
drop policy if exists "lectura publica" on public.compra_estado;
create policy "lectura publica" on public.compra_estado for select to anon, authenticated using (true);
revoke all on public.compra_estado from anon, authenticated;
grant select on public.compra_estado to anon, authenticated;

-- PIN compartido (solo se guarda su hash). Sin políticas: nadie la lee desde la API.
create table if not exists public.config (
  id       int primary key default 1 check (id = 1),
  pin_hash text not null
);
alter table public.config enable row level security;
revoke all on public.config from anon, authenticated;

create or replace function public.verificar_pin(p_pin text)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select exists (select 1 from public.config where pin_hash = crypt(p_pin, pin_hash));
$$;

create or replace function public.guardar_articulo(
  p_pin text, p_mes text, p_item text, p_comprado boolean,
  p_lidl_precio numeric, p_lidl_formato text,
  p_costco_precio numeric, p_costco_formato text
)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.verificar_pin(p_pin) then
    raise exception 'PIN incorrecto' using errcode = '28000';
  end if;
  insert into public.compra_estado as c
    (mes, item_id, comprado, lidl_precio, lidl_formato, costco_precio, costco_formato, actualizado)
  values
    (p_mes, p_item, coalesce(p_comprado, false), p_lidl_precio, nullif(trim(p_lidl_formato), ''),
     p_costco_precio, nullif(trim(p_costco_formato), ''), now())
  on conflict (mes, item_id) do update set
    comprado = excluded.comprado,
    lidl_precio = excluded.lidl_precio,
    lidl_formato = excluded.lidl_formato,
    costco_precio = excluded.costco_precio,
    costco_formato = excluded.costco_formato,
    actualizado = now();
end;
$$;

-- Desmarca todo el mes; los precios anotados se conservan
create or replace function public.desmarcar_mes(p_pin text, p_mes text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.verificar_pin(p_pin) then
    raise exception 'PIN incorrecto' using errcode = '28000';
  end if;
  update public.compra_estado set comprado = false, actualizado = now()
  where mes = p_mes and comprado;
end;
$$;

revoke all on function public.verificar_pin(text) from public;
revoke all on function public.guardar_articulo(text, text, text, boolean, numeric, text, numeric, text) from public;
revoke all on function public.desmarcar_mes(text, text) from public;
grant execute on function public.verificar_pin(text) to anon, authenticated;
grant execute on function public.guardar_articulo(text, text, text, boolean, numeric, text, numeric, text) to anon, authenticated;
grant execute on function public.desmarcar_mes(text, text) to anon, authenticated;

-- PIN: cambia CAMBIA_ESTE_PIN por el vuestro
insert into public.config (id, pin_hash)
values (1, extensions.crypt('CAMBIA_ESTE_PIN', extensions.gen_salt('bf')))
on conflict (id) do update set pin_hash = excluded.pin_hash;
