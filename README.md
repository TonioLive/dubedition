# DUB EDITION WEB

Web estática preparada para GitHub Pages.

## Archivos

- `index.html`: home principal.
- `kdds/`, `rutas/`, `eventos/`, `comunidad/`, `unete/`: cada sección en su carpeta (`index.html`) para tener URLs limpias.
- `style.css`: diseño completo responsive.
- `script.js`: menú móvil, pestañas, animaciones de entrada y efectos de scroll (parallax, barra de progreso, header que se oculta, marquee).
- `assets/photos/`: cada foto existe en `.jpg` y `.webp`. El navegador usa la WebP (≈40% menos peso) y la JPG queda de respaldo.

## Añadir o cambiar fotos

1. Sube la foto en `.jpg` (1080 px de ancho para tarjetas/galería, 1920 px para portadas).
2. Genera la versión WebP con el mismo nombre. Con Python:
   `python3 -c "from PIL import Image; Image.open('assets/photos/foto.jpg').save('assets/photos/foto.webp', quality=78, method=6)"`
3. En el HTML usa el mismo bloque `<picture>` que las demás (con `width`, `height` y `loading="lazy"`), salvo la portada, que lleva `fetchpriority="high"` y sin lazy.

## Rendimiento y animaciones

- Las animaciones solo usan `transform`/`opacity` y un único `requestAnimationFrame`, así el scroll en móvil va fluido.
- Si el usuario tiene activado "reducir movimiento" en su sistema, los efectos se desactivan.
- No pongas `overflow-x:hidden` en `html`: convierte `body` en un contenedor de scroll y en móvil el scroll se engancha.

## Subir a GitHub Pages

1. Sube todos los archivos al repositorio.
2. Ve a Settings > Pages.
3. Source: Deploy from a branch.
4. Branch: principal.
5. Folder: / root.
6. Guarda y espera a que GitHub publique.

## Formularios

GitHub Pages no procesa formularios ni guarda archivos porque es hosting estático.

Opciones recomendadas:

### Opción rápida: Formspree

1. Crea cuenta en Formspree.
2. Crea un formulario para empresas y otro para miembros.
3. Copia el endpoint.
4. En `unete.html`, cambia `action=""` por tu URL de Formspree.

Ejemplo:

```html
<form class="form-card" action="https://formspree.io/f/xxxxxxx" method="POST">
```

Para el formulario del club con fotos, revisa que el servicio elegido permita subida de archivos.

### Opción muy fácil: Google Forms

Puedes sustituir los formularios por botones que abran dos Google Forms diferentes.

## Enlaces incluidos

- Instagram: https://www.instagram.com/dubeditionvlc
- Canal: https://www.instagram.com/channel/AbYgdCJDxc26Cs2u/?igsh=MzJocHFnZHQ5ZnM3
- Hashtag: #seguimosenlonuestro
