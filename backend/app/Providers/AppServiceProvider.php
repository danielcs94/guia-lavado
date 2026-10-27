<?php

namespace App\Providers;

use Anthropic\Client;
use App\Laundry\Vision\ClaudePhotoReader;
use App\Laundry\Vision\OllamaPhotoReader;
use App\Laundry\Vision\PhotoReader;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PhotoReader::class, function () {
            if (config('services.vision') === 'claude') {
                $key = config('services.anthropic.key');

                return new ClaudePhotoReader(
                    $key ? new Client(apiKey: $key) : null,
                    config('services.anthropic.model'),
                );
            }

            return new OllamaPhotoReader(config('services.ollama.url'), config('services.ollama.model'));
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
