module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        // Configure the mochaTest tasks
        mochaTest: {
            unit: {
                options: {
                    reporter: 'spec',
                    //captureFile: 'results.txt', // Optionally capture the reporter output to a file
                    quiet: false, // Optionally suppress output to standard out (defaults to false)
                    clearRequireCache: false // Optionally clear the require cache before running tests (defaults to false)
                },
                src: ['test/**/*.js']
            }
        },

        jshint: {
            with_overrides: {
                options: {
                    esnext: true,
                    node:true
                },
                files: {
                    src: ['src/**/*.js']
                }
            }
        }
    });

    grunt.registerTask('default', ['jshint', 'mochaTest:unit']);
    grunt.registerTask('test', ['mochaTest:unit']);
    grunt.registerTask('lint', ['jshint']);

};