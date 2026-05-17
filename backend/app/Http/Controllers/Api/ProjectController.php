<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Canvas;
use App\Models\ProjectSetting;
use App\Models\Melody;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProjectController extends Controller
{
    /**
     * GET /projects
     * Список проектов текущего пользователя (без тяжёлых данных — segments и events не грузим).
     */
    public function index(Request $request)
    {
        $projects = Project::where('user_id', $request->user()->id)
            ->with([
                //'canvas:id,project_id,bg_color,width,height',  // без segments
                'canvas',
                'settings',
                'melody', 
                //'melody:id,project_id,total_duration,generated_at',
            ])
            ->orderBy('updated_at', 'desc')
            ->get();

        return response()->json($projects);
    }

    /**
     * GET /projects/{id}
     * Полные данные проекта — включая segments и events (для загрузки на холст).
     */
    public function show(Request $request, int $id)
    {
        $project = Project::where('user_id', $request->user()->id)
            ->with(['canvas', 'settings', 'melody'])
            ->findOrFail($id);

        return response()->json($project);
    }

    /**
     * POST /projects
     * Создать или обновить проект (если передан project_id — обновляем).
     *
     * Body (JSON):
     * {
     *   project_id?: int,          // если передан — обновляем существующий
     *   title: string,
     *   description?: string,
     *
     *   canvas: {
     *     segments: array,          // DrawingEngine.getAllSegments()
     *     bg_color: string,
     *     width: int,
     *     height: int,
     *   },
     *
     *   settings: {
     *     bpm: int,
     *     duration: int,
     *     scale: string,
     *     smoothing: int,
     *     reverb: float,
     *     delay: float,
     *     distortion: float,
     *   },
     *
     *   melody?: {                  // необязательно — только если мелодия была сгенерирована
     *     events: array,
     *     total_duration: int,
     *   }
     * }
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'project_id'              => 'nullable|integer',
            'title'                   => 'required|string|max:100',
            'description'             => 'nullable|string|max:500',

            'canvas'                  => 'required|array',
            'canvas.segments'         => 'required|array',
            'canvas.bg_color'         => 'required|string|max:20',
            'canvas.width'            => 'required|integer|min:100',
            'canvas.height'           => 'required|integer|min:100',

            'settings'                => 'required|array',
            'settings.bpm'            => 'required|integer|min:40|max:180',
            'settings.duration'       => 'required|integer|min:5|max:90',
            'settings.scale'          => 'required|in:major,minor',
            'settings.smoothing'      => 'required|integer|min:0|max:100',
            'settings.reverb'         => 'required|numeric|min:0|max:1',
            'settings.delay'          => 'required|numeric|min:0|max:1',
            'settings.distortion'     => 'required|numeric|min:0|max:1',

            'melody'                  => 'nullable|array',
            'melody.events'           => 'required_with:melody|array',
            'melody.total_duration'   => 'required_with:melody|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Ошибка валидации',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $data = $validator->validated();

        try {
            DB::beginTransaction();

            // Создаём или обновляем проект
            if (!empty($data['project_id'])) {
                $project = Project::where('id', $data['project_id'])
                    ->where('user_id', $user->id)
                    ->firstOrFail();
                $project->update([
                    'title'       => $data['title'],
                    'description' => $data['description'] ?? null,
                ]);
            } else {
                $project = Project::create([
                    'user_id'     => $user->id,
                    'title'       => $data['title'],
                    'description' => $data['description'] ?? null,
                ]);
            }

            // Холст — upsert по project_id
            Canvas::updateOrCreate(
                ['project_id' => $project->id],
                [
                    'segments' => $data['canvas']['segments'],
                    'bg_color' => $data['canvas']['bg_color'],
                    'width'    => $data['canvas']['width'],
                    'height'   => $data['canvas']['height'],
                ]
            );

            // Настройки — upsert по project_id
            ProjectSetting::updateOrCreate(
                ['project_id' => $project->id],
                [
                    'bpm'         => $data['settings']['bpm'],
                    'duration'    => $data['settings']['duration'],
                    'scale'       => $data['settings']['scale'],
                    'smoothing'   => $data['settings']['smoothing'],
                    'reverb'      => $data['settings']['reverb'],
                    'delay'       => $data['settings']['delay'],
                    'distortion'  => $data['settings']['distortion'],
                ]
            );

            // Мелодия — только если передана
            if (!empty($data['melody'])) {
                Melody::updateOrCreate(
                    ['project_id' => $project->id],
                    [
                        'events'         => $data['melody']['events'],
                        'total_duration' => $data['melody']['total_duration'],
                        'generated_at'   => now(),
                    ]
                );
            }

            DB::commit();

            return response()->json([
                'message'    => 'Проект сохранён',
                'project_id' => $project->id,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Ошибка сохранения проекта',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /projects/{id}
     */
    public function destroy(Request $request, int $id)
    {
        $project = Project::where('user_id', $request->user()->id)->findOrFail($id);
        $project->delete(); // cascadeOnDelete уберёт canvas, settings, melody

        return response()->json(['message' => 'Проект удалён']);
    }
}