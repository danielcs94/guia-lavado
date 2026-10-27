<?php

namespace App\Laundry\Vision;

final class JpegImage
{
    /**
     * Endereza la foto, la reduce para que su lado largo no pase de $maxSide
     * y la devuelve como JPEG en base64.
     */
    public static function base64(string $path, int $maxSide): string
    {
        $image = @imagecreatefromstring((string) file_get_contents($path));
        if ($image === false) {
            throw new PhotoReadException('Formato de imagen no soportado. Usa JPG, PNG o WebP.');
        }

        // Las fotos del móvil guardan la orientación en EXIF en vez de rotar los píxeles.
        $orientation = @exif_read_data($path)['Orientation'] ?? 1;
        $image = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1, $maxSide / max($width, $height));
        if ($scale < 1) {
            $image = imagescale($image, (int) round($width * $scale), (int) round($height * $scale));
        }

        ob_start();
        imagejpeg($image, quality: 85);

        return base64_encode((string) ob_get_clean());
    }
}
