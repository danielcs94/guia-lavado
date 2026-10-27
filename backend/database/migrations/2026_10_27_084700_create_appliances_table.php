<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appliances', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('kind');
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->json('programs');
            $table->json('temperatures');
            $table->json('spin_speeds');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appliances');
    }
};
