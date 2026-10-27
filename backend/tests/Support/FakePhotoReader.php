<?php

namespace Tests\Support;

use App\Laundry\Vision\PhotoReader;

final class FakePhotoReader implements PhotoReader
{
    public function __construct(
        private readonly array $label = [],
        private readonly array $appliance = [],
    ) {}

    public function readLabel(string $path): array
    {
        return $this->label;
    }

    public function readAppliance(string $path): array
    {
        return $this->appliance;
    }
}
